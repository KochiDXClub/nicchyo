import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const requestChatCompletion = vi.fn();
const insertLog = vi.fn();

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/ai/modelStore.server", () => ({
  resolveAiModelFor: async () => ({ modelId: "gpt-4o-mini" }),
}));
vi.mock("@/lib/ai/openaiFetch", () => ({
  requestChatCompletion: (...args: unknown[]) => requestChatCompletion(...args),
}));

/** 本人の cookie のクライアント。お店の登録内容は「山田農園」を返す */
vi.mock("@/utils/supabase/server", () => ({
  createClientWithExtensions: () => ({
    auth: { getUser: () => getUser() },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "vendors"
              ? { data: { shop_name: "山田農園", main_products: ["トマト"], payment_methods: ["cash"] } }
              : { data: null },
          // にちよさんがもう覚えていること
          limit: async () => (table === "store_knowledge" ? { data: [{ title: "混む時間" }] } : { data: [] }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/vendor/helpChatStats.server", async (importOriginal) => ({
  toDataWord: (await importOriginal<typeof import("@/lib/vendor/helpChatStats.server")>()).toDataWord,
  loadVendorHelpShopStats: async () => ({
    aiMentions: { total: 4, recommended: 2, topKeywords: ["トマト"] },
    hearts: { thisWeek: 3, total: 10 },
    topSales: [],
  }),
  loadVendorHelpMarketStats: async () => ({
    weeklyVisitors: 1200,
    monthlyVisitors: 5000,
    topSearchKeywords: ["いも天"],
    topSellingProducts: [],
  }),
}));
vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => ({
    from: () => ({ insert: (row: unknown) => insertLog(row) }),
  }),
}));

import { POST } from "./route";

const VENDOR = { id: "vendor-1", app_metadata: { role: "vendor" } };

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/vendor/help-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

/** OpenAI の SSE の形で、文字を2回に分けて返す */
function sseResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`)
        );
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

describe("POST /api/vendor/help-chat", () => {
  beforeEach(() => {
    getUser.mockReset();
    requestChatCompletion.mockReset();
    insertLog.mockReset();
    insertLog.mockResolvedValue({ error: null });
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("ログインしていなければ 401", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const res = await post({ text: "投稿のやり方は？" });

    expect(res.status).toBe(401);
    expect(requestChatCompletion).not.toHaveBeenCalled();
  });

  it("出店者でなければ 403", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u", app_metadata: { role: "general_user" } } } });

    const res = await post({ text: "投稿のやり方は？" });

    expect(res.status).toBe(403);
    expect(requestChatCompletion).not.toHaveBeenCalled();
  });

  it("空の質問は 400", async () => {
    getUser.mockResolvedValue({ data: { user: VENDOR } });

    const res = await post({ text: "   " });

    expect(res.status).toBe(400);
    expect(requestChatCompletion).not.toHaveBeenCalled();
  });

  it("お店の登録内容と使い方ガイドを渡し、答えを流して、質問と答えを記録する", async () => {
    getUser.mockResolvedValue({ data: { user: VENDOR } });
    requestChatCompletion.mockResolvedValue(sseResponse(["投稿は", "ここからやで"]));

    const res = await post({ text: "投稿のやり方は？" });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("投稿はここからやで");

    const [, , options] = requestChatCompletion.mock.calls[0];
    const system = (options as { messages: { role: string; content: string }[] }).messages[0].content;
    expect(system).toContain("・店名: 山田農園");
    expect(system).toContain("【にちよさんがもう覚えていること（トピックタイトル）】\n混む時間");
    expect(system).toContain("・支払い方法: 現金");
    expect(system).toContain("最新情報の投稿");
    expect(system).toContain("話題になった回数: 4回（そのうち、おすすめされた回数: 2回）");
    expect(system).toContain("nicchyo の来訪者数: 今週（月曜から今日まで） 1,200人 / 今月 5,000人");

    expect(insertLog).toHaveBeenCalledWith({
      vendor_id: "vendor-1",
      question: "投稿のやり方は？",
      answer: "投稿はここからやで",
    });
  });

  it("これまでのやりとりの合計が長すぎれば 400", async () => {
    getUser.mockResolvedValue({ data: { user: VENDOR } });
    const long = "あ".repeat(2000);

    const res = await post({
      text: "質問",
      history: [1, 2, 3, 4].map(() => ({ role: "user", text: long })),
    });

    expect(res.status).toBe(400);
    expect(requestChatCompletion).not.toHaveBeenCalled();
  });

  it("AI の呼び出しが失敗したら 502 を返し、記録はしない", async () => {
    getUser.mockResolvedValue({ data: { user: VENDOR } });
    requestChatCompletion.mockRejectedValue(new Error("network"));

    const res = await post({ text: "投稿のやり方は？" });

    expect(res.status).toBe(502);
    expect(insertLog).not.toHaveBeenCalled();
  });

  it("AI が変更案の関数を呼んだら、検証した案だけを区切り文字のあとに付けて返し、記録にも残す", async () => {
    getUser.mockResolvedValue({ data: { user: VENDOR } });
    const encoder = new TextEncoder();
    const events = [
      { choices: [{ delta: { content: "こうでええかえ？" } }] },
      {
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, function: { name: "propose_hours", arguments: '{"start_hour":7,"end_hour":13}' } },
              ],
            },
          },
        ],
      },
    ];
    requestChatCompletion.mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            for (const event of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        })
      )
    );

    const res = await post({ text: "営業時間を7時から13時にしたい" });

    const [, , options] = requestChatCompletion.mock.calls[0];
    expect((options as { tools: { function: { name: string } }[] }).tools.map((t) => t.function.name)).toContain(
      "propose_hours"
    );
    const [text, frame] = (await res.text()).split("\u001e");
    expect(text).toBe("こうでええかえ？");
    expect(JSON.parse(frame)).toEqual({
      type: "proposal",
      kind: "change",
      answer: { id: "hours", start: "7:00", end: "13:00" },
    });
    expect(insertLog.mock.calls[0][0].answer).toContain("［変更案］");
  });
});
