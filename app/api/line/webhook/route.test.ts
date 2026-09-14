import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { POST, GET } from "./route";

// モック
vi.mock("@/lib/line/client", () => ({
  sendLineReply: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/security/rateLimit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}));

import { sendLineReply } from "@/lib/line/client";

describe("app/api/line/webhook/route", () => {
  const secret = "test-secret";
  const token = "test-token";
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      LINE_CHANNEL_SECRET: secret,
      LINE_CHANNEL_ACCESS_TOKEN: token,
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createSignedRequest(body: Record<string, unknown>, customSecret = secret) {
    const rawBody = JSON.stringify(body);
    const signature = createHmac("sha256", customSecret)
      .update(rawBody, "utf8")
      .digest("base64");

    return new Request("http://localhost/api/line/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-line-signature": signature,
      },
      body: rawBody,
    });
  }

  it("GET リクエストはヘルスチェックとして 200 を返す", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toContain("LINE Webhook endpoint is healthy");
  });

  it("署名ヘッダーがない場合は 401 を返す", async () => {
    const req = new Request("http://localhost/api/line/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("署名が不一致の場合は 401 を返す", async () => {
    const req = createSignedRequest({ events: [] }, "wrong-secret");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("環境変数が不足している場合は 500 を返す", async () => {
    delete process.env.LINE_CHANNEL_SECRET;
    const req = createSignedRequest({ events: [] });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("空の events 配列でも正常に 200 を返す（LINE疎通確認用）", async () => {
    const req = createSignedRequest({ destination: "U123", events: [] });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(sendLineReply).not.toHaveBeenCalled();
  });

  it("follow（友だち追加）イベントを受信したときに挨拶メッセージを返信する", async () => {
    const req = createSignedRequest({
      destination: "U123",
      events: [
        {
          type: "follow",
          mode: "active",
          timestamp: Date.now(),
          source: { type: "user", userId: "U_user_follow" },
          webhookEventId: "evt_1",
          replyToken: "reply_token_follow",
          deliveryContext: { isRedelivery: false },
        },
      ],
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(sendLineReply).toHaveBeenCalledWith(
      token,
      "reply_token_follow",
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("友だち追加、まっことありがとうねぇ！"),
        }),
      ])
    );
  });

  it("text（テキストメッセージ）イベントを受信したときに返信を生成して送信する", async () => {
    const req = createSignedRequest({
      destination: "U123",
      events: [
        {
          type: "message",
          mode: "active",
          timestamp: Date.now(),
          source: { type: "user", userId: "U_user_text" },
          webhookEventId: "evt_2",
          replyToken: "reply_token_text",
          deliveryContext: { isRedelivery: false },
          message: {
            id: "msg_1",
            type: "text",
            text: "マップ",
          },
        },
      ],
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(sendLineReply).toHaveBeenCalledWith(
      token,
      "reply_token_text",
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("日曜市マップはこちらから"),
        }),
      ])
    );
  });

  it("sticker（スタンプ）イベントを受信したときにお礼メッセージを返信する", async () => {
    const req = createSignedRequest({
      destination: "U123",
      events: [
        {
          type: "message",
          mode: "active",
          timestamp: Date.now(),
          source: { type: "user", userId: "U_user_sticker" },
          webhookEventId: "evt_3",
          replyToken: "reply_token_sticker",
          deliveryContext: { isRedelivery: false },
          message: {
            id: "msg_2",
            type: "sticker",
            packageId: "1",
            stickerId: "1",
          },
        },
      ],
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(sendLineReply).toHaveBeenCalledWith(
      token,
      "reply_token_sticker",
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("スタンプありがとう！"),
        }),
      ])
    );
  });
});
