// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestChatCompletion = vi.fn();
vi.mock("@/lib/ai/openaiFetch", () => ({
  requestChatCompletion: (...args: unknown[]) => requestChatCompletion(...args),
}));
vi.mock("@/lib/ai/modelStore.server", () => ({
  resolveAiModelFor: async () => ({ def: { id: "test-model", provider: "openai" } }),
}));

import { translateQuestionForSearch } from "./searchQuestion";

function reply(content: string, ok = true) {
  return { ok, json: async () => ({ choices: [{ message: { content } }] }) };
}

describe("translateQuestionForSearch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("日本語の画面では呼ばずに元の質問を返す", async () => {
    expect(await translateQuestionForSearch("key", "おすすめは？", "ja")).toBe("おすすめは？");
    expect(requestChatCompletion).not.toHaveBeenCalled();
  });

  it("英語の画面では訳した日本語を返す", async () => {
    requestChatCompletion.mockResolvedValue(reply(" おすすめのお店は？ "));
    expect(await translateQuestionForSearch("key", "Any shop you recommend?", "en")).toBe("おすすめのお店は？");
    const params = requestChatCompletion.mock.calls[0][2];
    expect(params.messages[1]).toEqual({ role: "user", content: "Any shop you recommend?" });
  });

  it("API が失敗したら元の質問で続ける", async () => {
    requestChatCompletion.mockResolvedValue(reply("", false));
    expect(await translateQuestionForSearch("key", "Where to eat?", "en")).toBe("Where to eat?");
  });

  it("例外でも元の質問で続ける", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    requestChatCompletion.mockRejectedValue(new Error("network"));
    expect(await translateQuestionForSearch("key", "Where to eat?", "en")).toBe("Where to eat?");
  });

  it("空の訳は元の質問を返す", async () => {
    requestChatCompletion.mockResolvedValue(reply("  "));
    expect(await translateQuestionForSearch("key", "Where to eat?", "en")).toBe("Where to eat?");
  });
});
