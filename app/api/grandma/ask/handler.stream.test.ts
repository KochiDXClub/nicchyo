// @vitest-environment node
// ask のストリーム（createStreamingConsultResponse）の、離脱・上流の失敗・タイムアウトの扱い
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/analytics/collectionSettings.server", () => ({ isAnalyticsCollectionEnabled: async () => true }));

const requestChatCompletion = vi.fn();

vi.mock("@/lib/ai/openaiFetch", () => ({
  requestChatCompletion: (...args: unknown[]) => requestChatCompletion(...args),
  requestEmbeddings: vi.fn(),
  readOpenAiError: vi.fn(async () => ({ summary: "" })),
}));
vi.mock("@/lib/ai/modelStore.server", () => ({ resolveAiModelFor: vi.fn(async () => ({})) }));
vi.mock("@/lib/ai/conversationSettings.server", () => ({
  fetchAiConversationSettings: vi.fn(async () => ({
    "consult.max_turns": 2,
    "consult.max_output_tokens": 300,
  })),
}));
vi.mock("@/lib/grandma/prompts/promptStore.server", async () => {
  const { DEFAULT_AI_PROMPTS } = await import("@/lib/grandma/prompts/promptKeys");
  return { fetchAiPrompts: vi.fn(async () => DEFAULT_AI_PROMPTS) };
});
vi.mock("@/lib/guide/spotSupport.server", () => ({
  loadSpotSupport: vi.fn(async () => ({ prompt: "" })),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

import {
  ASK_EMBEDDING_TIMEOUT_MS,
  ASK_UPSTREAM_TIMEOUT_MS,
  createStreamingConsultResponse,
} from "./handler";
import { SEARCH_TRANSLATION_TIMEOUT_MS } from "@/lib/grandma/searchQuestion";
import { CONSULT_CHARACTERS } from "@/app/(public)/consult/data/consultCharacters";

/** 回答の組み立て・保存（finalizeConsultResponse）に入ったら supabase に触る。触られたら検知する */
const supabaseFrom = vi.fn();

function startStream() {
  return createStreamingConsultResponse({
    openaiKey: "sk-test",
    selectedCharacters: [CONSULT_CHARACTERS[0]],
    userContent: "いも天はどこ？",
    supabase: { from: supabaseFrom } as never,
    consultId: "consult-1",
    text: "いも天はどこ？",
    keywords: [],
    location: null,
    visitorKey: null,
    targetShopName: null,
    targetShop: null,
    candidateShops: [],
    shopIntent: false,
    memorySummary: "",
    locale: "ja",
  });
}

/** OpenAI から届いた体のレスポンス。close するまで読み取りは待たされる */
function fakeUpstream() {
  const state = { cancelled: false };
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return { state, controller: () => controller, response: new Response(body, { status: 200 }) };
}

async function readEvents(body: ReadableStream<Uint8Array>) {
  const text = await new Response(body).text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { type: string; response?: { errorCode?: string; retryable?: boolean } });
}

describe("createStreamingConsultResponse", () => {
  beforeEach(() => {
    requestChatCompletion.mockReset();
    supabaseFrom.mockReset();
  });

  it("OpenAI を待つ上限として signal を渡す（翻訳・埋め込みと合わせてクライアントの60秒より短い）", async () => {
    const upstream = fakeUpstream();
    requestChatCompletion.mockResolvedValue(upstream.response);

    const res = await startStream();
    await res.body!.cancel();

    const signal = requestChatCompletion.mock.calls[0][3];
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(
      SEARCH_TRANSLATION_TIMEOUT_MS + ASK_EMBEDDING_TIMEOUT_MS + ASK_UPSTREAM_TIMEOUT_MS,
    ).toBeLessThan(60_000);
  });

  it("利用者が離れたら OpenAI の受信を止め、回答の組み立て・保存には進まない", async () => {
    const upstream = fakeUpstream();
    requestChatCompletion.mockResolvedValue(upstream.response);

    const res = await startStream();
    await res.body!.cancel();

    expect(upstream.state.cancelled).toBe(true);
    // 読み取りループが抜けて終わるのを待つ
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(supabaseFrom).not.toHaveBeenCalled();
  });

  it("OpenAI からの受信が途中で失敗したら、再送できる system_error を final で返す", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("aborted"));
      },
    });
    requestChatCompletion.mockResolvedValue(new Response(body, { status: 200 }));

    const res = await startStream();
    const events = await readEvents(res.body!);

    expect(events.at(-1)).toMatchObject({
      type: "final",
      response: { errorCode: "system_error", retryable: true },
    });
  });

  describe("1人目の発話の途中経過（first_turn_delta）", () => {
    /** モデルの出力を SSE の data 行として 1 つずつ流し、届いた first_turn_delta をつなげて返す */
    async function streamedText(chunks: string[]) {
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const content of chunks) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
            );
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      requestChatCompletion.mockResolvedValue(new Response(body, { status: 200 }));
      const res = await startStream();
      const text = await new Response(res.body!).text();
      return text
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { type: string; delta?: string })
        .filter((event) => event.type === "first_turn_delta")
        .map((event) => event.delta)
        .join("");
    }

    it("通常の形式（TURN 行のあとに別の行）では、本文だけを流す", async () => {
      const text = await streamedText([
        "TURN|nichiyosan|にちよさん|いも天は",
        "三丁目にあるよ。\nSHOP_IDS|12,34\nFOLLOW_UP|ほかには？",
      ]);
      expect(text).toBe("いも天は三丁目にあるよ。");
    });

    it("区切りが2つの chunk にまたがっても、途中の `|FOLL` を見せない", async () => {
      const text = await streamedText([
        "TURN|nichiyosan|にちよさん|いも天は三丁目にあるよ。|FOLL",
        "OW_UP|ほかには？\n",
      ]);
      expect(text).toBe("いも天は三丁目にあるよ。");
    });

    it("本文に `|` があっても、区切りでなければそのまま流す", async () => {
      const text = await streamedText(["TURN|nichiyosan|にちよさん|AとB|Cだよ。\n"]);
      expect(text).toBe("AとB|Cだよ。");
    });

    it.each(["|FOLLOW_UP|", "|SHOP_IDS|"])(
      "同じ行の後ろに %s が続いても、その手前で止める",
      async (marker) => {
        const text = await streamedText([
          "TURN|nichiyosan|にちよさん|いも天は三丁目にあるよ。",
          `${marker}ほかには？\n`,
        ]);
        expect(text).toBe("いも天は三丁目にあるよ。");
      }
    );
  });

  it("開始前にタイムアウトして上流が投げた例外は、呼び出し側（handleConsultAsk の catch）へ伝える", async () => {
    requestChatCompletion.mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    await expect(startStream()).rejects.toThrow("timeout");
  });
});
