import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import {
  ANTHROPIC_DEFAULT_MAX_TOKENS,
  anthropicErrorResponse,
  stripJsonFence,
  toAnthropicParams,
  toOpenAiCompletion,
  toOpenAiSseStream,
} from "./anthropicAdapter";

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

async function* events(list: unknown[]): AsyncGenerator<Anthropic.MessageStreamEvent> {
  for (const event of list) yield event as Anthropic.MessageStreamEvent;
}

describe("toAnthropicParams", () => {
  it("system を分け、user / assistant をそのまま渡す", () => {
    const params = toAnthropicParams({
      model: "claude-haiku-5-5",
      max_tokens: 300,
      messages: [
        { role: "system", content: "A" },
        { role: "user", content: "こんにちは" },
        { role: "assistant", content: "はい" },
        { role: "system", content: "B" },
        { role: "user", content: "つづき" },
      ],
    });
    expect(params.system).toBe("A\n\nB");
    expect(params.messages).toEqual([
      { role: "user", content: "こんにちは" },
      { role: "assistant", content: "はい" },
      { role: "user", content: "つづき" },
    ]);
    expect(params.max_tokens).toBe(300);
  });

  it("考え込まない設定にし、temperature は送らない", () => {
    const params = toAnthropicParams({
      model: "claude-haiku-5-5",
      max_tokens: 100,
      messages: [{ role: "user", content: "x" }],
      temperature: 0.7,
    });
    expect(params.thinking).toEqual({ type: "disabled" });
    expect("temperature" in params).toBe(false);
  });

  it("出力上限が無いときは既定値を入れる（Messages API は必須）", () => {
    const params = toAnthropicParams({ model: "m", messages: [{ role: "user", content: "x" }] });
    expect(params.max_tokens).toBe(ANTHROPIC_DEFAULT_MAX_TOKENS);
  });

  it("相談の写真（data URL）は画像ブロックにして渡す", () => {
    const params = toAnthropicParams({
      model: "m",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "これは何？" },
            { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } },
          ],
        },
      ],
    });
    expect(params.messages).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "これは何？" },
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "QUJD" } },
        ],
      },
    ]);
  });

  it("対応していない形式の画像は落とし、文字だけを送る", () => {
    const params = toAnthropicParams({
      model: "m",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "見て" },
            { type: "image_url", image_url: { url: "data:image/heic;base64,QUJD" } },
          ],
        },
      ],
    });
    expect(params.messages).toEqual([{ role: "user", content: "見て" }]);
  });

  it("空の発言は送らない", () => {
    const params = toAnthropicParams({
      model: "m",
      messages: [
        { role: "user", content: "" },
        { role: "user", content: "x" },
      ],
    });
    expect(params.messages).toEqual([{ role: "user", content: "x" }]);
  });

  it("関数（tools）を Messages API の形にし、並列呼び出しを止める", () => {
    const params = toAnthropicParams({
      model: "m",
      messages: [{ role: "user", content: "x" }],
      tools: [
        {
          type: "function",
          function: { name: "propose", description: "案", parameters: { type: "object", properties: {} } },
        },
      ],
      parallel_tool_calls: false,
    });
    expect(params.tools).toEqual([
      { name: "propose", description: "案", input_schema: { type: "object", properties: {} } },
    ]);
    expect(params.tool_choice).toEqual({ type: "auto", disable_parallel_tool_use: true });
  });

  it("json_schema を求められたら、スキーマを system に書き足す", () => {
    const params = toAnthropicParams({
      model: "m",
      messages: [
        { role: "system", content: "元の指示" },
        { role: "user", content: "x" },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "r", schema: { type: "object", properties: { a: { type: "string" } } } },
      },
    });
    expect(params.system).toContain("元の指示");
    expect(params.system).toContain('"a":{"type":"string"}');
  });
});

describe("toOpenAiCompletion", () => {
  const base = {
    id: "msg_1",
    model: "claude-haiku-5-5",
    usage: { input_tokens: 10, output_tokens: 5 },
  };

  it("本文と finish_reason を OpenAI の形にする", () => {
    const out = toOpenAiCompletion(
      { ...base, content: [{ type: "text", text: "やあ" }], stop_reason: "end_turn" } as unknown as Anthropic.Message,
      false
    );
    expect(out.choices[0].message.content).toBe("やあ");
    expect(out.choices[0].finish_reason).toBe("stop");
    expect(out.usage.total_tokens).toBe(15);
  });

  it("出力上限で切れたら finish_reason は length", () => {
    const out = toOpenAiCompletion(
      { ...base, content: [{ type: "text", text: "…" }], stop_reason: "max_tokens" } as unknown as Anthropic.Message,
      false
    );
    expect(out.choices[0].finish_reason).toBe("length");
  });

  it("関数呼び出しを tool_calls にする", () => {
    const out = toOpenAiCompletion(
      {
        ...base,
        content: [{ type: "tool_use", id: "t1", name: "propose", input: { a: 1 } }],
        stop_reason: "tool_use",
      } as unknown as Anthropic.Message,
      false
    );
    expect(out.choices[0].message.tool_calls).toEqual([
      { id: "t1", type: "function", function: { name: "propose", arguments: '{"a":1}' } },
    ]);
    expect(out.choices[0].finish_reason).toBe("tool_calls");
  });

  it("JSON を求めたときはコードブロックを外す", () => {
    const out = toOpenAiCompletion(
      { ...base, content: [{ type: "text", text: '```json\n{"a":1}\n```' }], stop_reason: "end_turn" } as unknown as Anthropic.Message,
      true
    );
    expect(out.choices[0].message.content).toBe('{"a":1}');
  });
});

describe("stripJsonFence", () => {
  it("コードブロックでなければそのまま返す", () => {
    expect(stripJsonFence('{"a":1}')).toBe('{"a":1}');
  });
});

describe("toOpenAiSseStream", () => {
  it("本文の差分を OpenAI の SSE に直し、最後に finish と [DONE] を付ける", async () => {
    const out = await readAll(
      toOpenAiSseStream(
        events([
          { type: "message_start" },
          { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "こん" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "にちは" } },
          { type: "message_delta", delta: { stop_reason: "end_turn" } },
        ])
      )
    );
    const datas = out
      .split("\n\n")
      .filter(Boolean)
      .map((chunk) => chunk.replace(/^data: /, ""));
    expect(datas.at(-1)).toBe("[DONE]");
    const parsed = datas.slice(0, -1).map((d) => JSON.parse(d));
    expect(parsed.map((p) => p.choices[0].delta.content).filter(Boolean).join("")).toBe("こんにちは");
    expect(parsed.at(-1).choices[0].finish_reason).toBe("stop");
  });

  it("関数呼び出しの断片を、関数の番号ごとにつなげられる形で流す", async () => {
    const out = await readAll(
      toOpenAiSseStream(
        events([
          { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "t1", name: "propose", input: {} } },
          { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"a"' } },
          { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: ":1}" } },
          { type: "message_delta", delta: { stop_reason: "tool_use" } },
        ])
      )
    );
    const parsed = out
      .split("\n\n")
      .filter((c) => c && !c.includes("[DONE]"))
      .map((c) => JSON.parse(c.replace(/^data: /, "")));
    const calls = parsed.flatMap((p) => p.choices[0].delta.tool_calls ?? []);
    expect(calls.every((c: { index: number }) => c.index === 0)).toBe(true);
    expect(calls.map((c: { function: { arguments?: string } }) => c.function.arguments ?? "").join("")).toBe('{"a":1}');
    expect(parsed.at(-1).choices[0].finish_reason).toBe("tool_calls");
  });

  it("途中で失敗したら正常終了に見せずエラーにする", async () => {
    async function* broken(): AsyncGenerator<Anthropic.MessageStreamEvent> {
      yield { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "a" } } as Anthropic.MessageStreamEvent;
      throw new Error("boom");
    }
    await expect(readAll(toOpenAiSseStream(broken()))).rejects.toThrow("boom");
  });
});

describe("anthropicErrorResponse", () => {
  it("OpenAI と同じ形のエラーにする", async () => {
    const res = anthropicErrorResponse(new Error("network"));
    expect(res.ok).toBe(false);
    const json = (await res.json()) as { error: { message: string } };
    expect(json.error.message).toBe("network");
  });
});
