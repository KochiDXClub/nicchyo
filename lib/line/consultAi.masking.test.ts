import { describe, it, expect, vi, beforeEach } from "vitest";

const requestChatCompletion = vi.fn();

vi.mock("../ai/openaiFetch", () => ({
  requestChatCompletion: (...args: unknown[]) => requestChatCompletion(...args),
}));
vi.mock("../ai/modelStore.server", () => ({
  resolveAiModelFor: async () => ({ modelId: "gpt-4o-mini" }),
}));

import { generateLineConsultReply } from "./consultAi";

describe("generateLineConsultReply の個人情報マスク", () => {
  beforeEach(() => {
    requestChatCompletion.mockReset();
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("OpenAI へ送る本文から電話番号・メールアドレスをマスクする", async () => {
    requestChatCompletion.mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "ええよ" } }] }), { status: 200 })
    );

    await generateLineConsultReply("いも天のお店を教えて。090-1234-5678 か taro@example.com まで");

    const [, , options] = requestChatCompletion.mock.calls[0];
    const user = (options as { messages: { role: string; content: string }[] }).messages.find(
      (m) => m.role === "user"
    );
    expect(user?.content).toBe("いも天のお店を教えて。[電話番号] か [メールアドレス] まで");
  });
});
