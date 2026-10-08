import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CODE_AI_CATALOG, resolveAiModelChoice } from "./models";
import {
  EMBEDDING_MODEL,
  readOpenAiError,
  requestChatCompletion,
  requestEmbeddings,
} from "./openaiFetch";

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

    it("上流の失敗レスポンスは解釈せずそのまま返す（失敗時の返し方は呼び出し側の責任）", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
      vi.spyOn(console, "error").mockImplementation(() => {});
      const res = await requestChatCompletion("sk-test", model, { messages });
      expect(res.ok).toBe(false);
      expect(res.status).toBe(500);
      // ボディは clone から読むので、呼び出し側がまだ読める
      expect(await res.text()).toBe("boom");
    });

    describe("model_not_found のフォールバック", () => {
      const notFound = () =>
        new Response(
          JSON.stringify({
            error: { code: "model_not_found", message: "Project does not have access" },
          }),
          { status: 400 }
        );
      const nano = resolveAiModelChoice(
        CODE_AI_CATALOG,
        { modelId: "gpt-5.4-nano", reasoningEffort: "low" },
        "consult"
      );

      beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
      });

      it("選んだモデルが使えなければ既定モデルでやり直す", async () => {
        const fetchMock = vi
          .fn()
          .mockResolvedValueOnce(notFound())
          .mockResolvedValueOnce(new Response("{}", { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        const res = await requestChatCompletion("sk-test", nano, { messages, maxOutputTokens: 100 });
        expect(res.ok).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        // 2回目は既定モデルの流儀（max_tokens、reasoning_effort 無し）で送る
        expect(lastCall().body).toEqual({ model: "gpt-4o-mini", messages, max_tokens: 100 });
      });

      it("既定モデルそのものが使えないときはやり直さない", async () => {
        const fetchMock = vi.fn().mockResolvedValue(notFound());
        vi.stubGlobal("fetch", fetchMock);
        const res = await requestChatCompletion("sk-test", model, { messages });
        expect(res.status).toBe(400);
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      it("model_not_found 以外の失敗ではやり直さない", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: { code: "rate_limit_exceeded" } }), { status: 429 })
        );
        vi.stubGlobal("fetch", fetchMock);
        const res = await requestChatCompletion("sk-test", nano, { messages });
        expect(res.status).toBe(429);
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      it("fallbackDef を外して渡せば、使えないモデルの失敗がそのまま返る（管理画面のテスト用）", async () => {
        const fetchMock = vi.fn().mockResolvedValue(notFound());
        vi.stubGlobal("fetch", fetchMock);
        const { fallbackDef: _omit, ...noFallback } = nano;
        void _omit;
        const res = await requestChatCompletion("sk-test", noFallback, { messages });
        expect(res.status).toBe(400);
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("readOpenAiError", () => {
    it("OpenAI のエラー本文から code と message を取り出す", async () => {
      const res = new Response(
        JSON.stringify({ error: { code: "model_not_found", message: "no access" } }),
        { status: 400 }
      );
      const detail = await readOpenAiError(res);
      expect(detail).toEqual({
        status: 400,
        code: "model_not_found",
        message: "no access",
        summary: "HTTP 400 model_not_found: no access",
      });
    });

    it("JSON でない本文はそのまま message にする", async () => {
      const detail = await readOpenAiError(new Response("Bad Gateway", { status: 502 }));
      expect(detail.code).toBeNull();
      expect(detail.summary).toBe("HTTP 502: Bad Gateway");
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
