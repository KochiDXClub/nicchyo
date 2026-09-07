import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CODE_AI_CATALOG, resolveAiModelChoice } from "./models";
import { EMBEDDING_MODEL, requestChatCompletion, requestEmbeddings } from "./openaiFetch";

const model = resolveAiModelChoice(CODE_AI_CATALOG, { modelId: "gpt-4o-mini" }, "consult");

/** 直近の fetch 呼び出しから URL・ヘッダ・パース済みボディを取り出す */
function lastCall() {
  const mock = vi.mocked(globalThis.fetch);
  const [url, init] = mock.mock.calls.at(-1) as [string, RequestInit];
  return {
    url,
    init,
    headers: init.headers as Record<string, string>,
    body: JSON.parse(init.body as string),
  };
}

describe("openaiFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("requestChatCompletion", () => {
    const messages = [{ role: "system", content: "テスト" }];

    it("Chat Completions のエンドポイントへ POST する", async () => {
      await requestChatCompletion("sk-test", model, { messages });
      const call = lastCall();
      expect(call.url).toBe("https://api.openai.com/v1/chat/completions");
      expect(call.init.method).toBe("POST");
    });

    it("APIキーを Authorization ヘッダに載せる", async () => {
      await requestChatCompletion("sk-test", model, { messages });
      const call = lastCall();
      expect(call.headers.Authorization).toBe("Bearer sk-test");
      expect(call.headers["Content-Type"]).toBe("application/json");
    });

    // ボディの組み立ては models.ts に任せている。呼び出し側が model や
    // max_tokens を直接書かなくてよくなっていることを、ここでも押さえておく
    it("モデルごとの差の吸収を buildChatCompletionBody に通す", async () => {
      await requestChatCompletion("sk-test", model, {
        messages,
        maxOutputTokens: 500,
        temperature: 0.7,
      });
      expect(lastCall().body).toEqual({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 500,
        temperature: 0.7,
      });
    });

    it("ストリーミング指定をそのまま渡す", async () => {
      await requestChatCompletion("sk-test", model, { messages, stream: true });
      expect(lastCall().body.stream).toBe(true);
    });

    it("上流のレスポンスを解釈せずそのまま返す（失敗時の扱いは呼び出し側の責任）", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
      const res = await requestChatCompletion("sk-test", model, { messages });
      expect(res.ok).toBe(false);
      expect(res.status).toBe(500);
    });
  });

  describe("requestEmbeddings", () => {
    it("Embeddings のエンドポイントへ POST する", async () => {
      await requestEmbeddings("sk-test", "文旦");
      const call = lastCall();
      expect(call.url).toBe("https://api.openai.com/v1/embeddings");
      expect(call.init.method).toBe("POST");
      expect(call.headers.Authorization).toBe("Bearer sk-test");
    });

    it("埋め込みモデル名を1箇所に集約する", async () => {
      await requestEmbeddings("sk-test", "文旦");
      expect(lastCall().body.model).toBe(EMBEDDING_MODEL);
    });

    it("1件でも複数件でも、渡した形のまま input に載せる", async () => {
      await requestEmbeddings("sk-test", "文旦");
      expect(lastCall().body.input).toBe("文旦");

      await requestEmbeddings("sk-test", ["文旦", "小夏"]);
      expect(lastCall().body.input).toEqual(["文旦", "小夏"]);
    });
  });
});
