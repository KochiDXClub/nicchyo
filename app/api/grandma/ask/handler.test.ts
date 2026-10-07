import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextResponse } from "next/server";

const requireSameOrigin = vi.fn();
const enforceRateLimit = vi.fn();
const createClient = vi.fn(() => {
  throw new Error("入力検証で弾く前に DB へ触ってはいけない");
});

vi.mock("@/lib/security/requestGuards", () => ({
  requireSameOrigin: (...args: unknown[]) => requireSameOrigin(...args),
}));
vi.mock("@/lib/security/rateLimit", () => ({
  enforceRateLimit: (...args: unknown[]) => enforceRateLimit(...args),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => createClient() }));

import { handleConsultAsk } from "./handler";
import {
  ASK_IMAGE_MAX_BYTES,
  ASK_MEMORY_SUMMARY_MAX,
  ASK_SHOP_NAME_MAX,
  ASK_TEXT_MAX,
} from "@/lib/grandma/askInput";

function postJson(body: unknown) {
  return handleConsultAsk(
    new Request("http://localhost/api/grandma/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

function postForm(form: FormData) {
  return handleConsultAsk(
    new Request("http://localhost/api/grandma/ask", { method: "POST", body: form })
  );
}

describe("handleConsultAsk の入力検証", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSameOrigin.mockReturnValue({ ok: true });
    enforceRateLimit.mockResolvedValue(null);
  });

  it("別オリジンは 403", async () => {
    requireSameOrigin.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: "Invalid origin" }, { status: 403 }),
    });
    expect((await postJson({ text: "おすすめは？" })).status).toBe(403);
  });

  it("レート制限超過は 429", async () => {
    enforceRateLimit.mockResolvedValue(NextResponse.json({ error: "rate" }, { status: 429 }));
    expect((await postJson({ text: "おすすめは？" })).status).toBe(429);
  });

  it.each([
    ["text", { text: "あ".repeat(ASK_TEXT_MAX + 1) }],
    ["memorySummary", { text: "おすすめは？", memorySummary: "あ".repeat(ASK_MEMORY_SUMMARY_MAX + 1) }],
    ["shopName", { text: "おすすめは？", shopName: "あ".repeat(ASK_SHOP_NAME_MAX + 1) }],
    ["location の範囲外", { text: "おすすめは？", location: { lat: 999, lng: 0 } }],
  ])("JSON: %s の超過は 400", async (_label, body) => {
    const res = await postJson(body);
    expect(res.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each([
    ["text", { text: "あ".repeat(ASK_TEXT_MAX + 1) }],
    ["memorySummary", { text: "おすすめは？", memorySummary: "あ".repeat(ASK_MEMORY_SUMMARY_MAX + 1) }],
    ["shopName", { text: "おすすめは？", shopName: "あ".repeat(ASK_SHOP_NAME_MAX + 1) }],
  ])("multipart: %s の超過は 400", async (_label, fields) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    expect((await postForm(form)).status).toBe(400);
  });

  it("multipart: 画像が許可形式でない(gif)と 400", async () => {
    const form = new FormData();
    form.append("text", "これは何？");
    form.append(
      "image",
      new File([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])], "a.gif", { type: "image/gif" })
    );
    expect((await postForm(form)).status).toBe(400);
  });

  it("multipart: MIME を偽った画像（中身が画像でない）は 400", async () => {
    const form = new FormData();
    form.append("text", "これは何？");
    form.append(
      "image",
      new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], "a.jpg", { type: "image/jpeg" })
    );
    expect((await postForm(form)).status).toBe(400);
  });

  it("multipart: 5MB を超える画像は 400", async () => {
    const form = new FormData();
    form.append("text", "これは何？");
    const big = new Uint8Array(ASK_IMAGE_MAX_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    form.append("image", new File([big], "a.jpg", { type: "image/jpeg" }));
    expect((await postForm(form)).status).toBe(400);
  });
});
