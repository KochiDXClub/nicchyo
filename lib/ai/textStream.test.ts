import { describe, expect, it, vi } from "vitest";
import { openAiSseToTextStream, TEXT_STREAM_DATA_SEPARATOR } from "./textStream";

function sse(chunks: string[], extra = "") {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`)
        );
      }
      if (extra) controller.enqueue(encoder.encode(extra));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

describe("openAiSseToTextStream", () => {
  it("答えの文字だけを流し、壊れた断片は飛ばす", async () => {
    const stream = openAiSseToTextStream(sse(["こん", "にちは"], "data: {broken\n\n"));

    expect(await new Response(stream).text()).toBe("こんにちは");
  });

  it("流し終わったら、答えの全文を onFinish に渡す", async () => {
    const onFinish = vi.fn();
    const stream = openAiSseToTextStream(sse(["投稿は", "ここから"]), { onFinish });

    await new Response(stream).text();

    expect(onFinish).toHaveBeenCalledWith("投稿はここから", { truncated: false });
  });

  it("onFinish が失敗しても、答えは最後まで流れる", async () => {
    const stream = openAiSseToTextStream(sse(["はい"]), {
      onFinish: () => Promise.reject(new Error("db down")),
    });

    expect(await new Response(stream).text()).toBe("はい");
  });

  it("利用者側で切れたら、元のストリームの受け取りも止める", async () => {
    const cancel = vi.fn();
    const upstream = new ReadableStream<Uint8Array>({ pull() {}, cancel });
    const stream = openAiSseToTextStream(upstream);

    await stream.cancel();

    expect(cancel).toHaveBeenCalled();
  });

  it("行や文字（UTF-8 の多バイト）がチャンクの境目で割れても、正しく読む", async () => {
    const bytes = new TextEncoder().encode(
      `data: ${JSON.stringify({ choices: [{ delta: { content: "日曜市" } }] })}\n\ndata: [DONE]\n\n`
    );
    // 「日」の3バイトの途中と、data: 行の途中で切る
    const cuts = [10, bytes.indexOf(0xe6) + 1, bytes.length - 5];
    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        let from = 0;
        for (const cut of [...cuts, bytes.length]) {
          controller.enqueue(bytes.slice(from, cut));
          from = cut;
        }
        controller.close();
      },
    });

    expect(await new Response(openAiSseToTextStream(upstream)).text()).toBe("日曜市");
  });

  it("OpenAI からの受け取りが途中で失敗したら、途中までを記録し、利用者側にも失敗を伝える", async () => {
    const encoder = new TextEncoder();
    let pulls = 0;
    const upstream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "途中" } }] })}\n\n`));
        } else {
          controller.error(new Error("reset"));
        }
      },
    });
    const onFinish = vi.fn();
    const reader = openAiSseToTextStream(upstream, { onFinish }).getReader();

    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toBe("途中");
    await expect(reader.read()).rejects.toThrow();
    expect(onFinish).toHaveBeenCalledWith("途中", { truncated: true });
  });
});

function sseRaw(events: unknown[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

describe("openAiSseToTextStream の関数呼び出し", () => {
  const toolDelta = (index: number, name: string | undefined, args: string) => ({
    choices: [{ delta: { tool_calls: [{ index, function: { ...(name ? { name } : {}), arguments: args } }] } }],
  });

  it("断片で届いた関数呼び出しをつないで渡し、返した文字を区切り文字のあとに付ける", async () => {
    const onToolCalls = vi.fn(() => "TRAILER");
    const stream = openAiSseToTextStream(
      sseRaw([
        { choices: [{ delta: { content: "こうでええ？" } }] },
        toolDelta(0, "propose_hours", '{"start_'),
        toolDelta(0, undefined, 'hour":7,"end_hour":13}'),
      ]),
      { onToolCalls }
    );

    expect(await new Response(stream).text()).toBe(`こうでええ？${TEXT_STREAM_DATA_SEPARATOR}TRAILER`);
    expect(onToolCalls).toHaveBeenCalledWith([
      { name: "propose_hours", arguments: '{"start_hour":7,"end_hour":13}' },
    ]);
  });

  it("本文に区切り文字が混じっていたら取り除く（変更案のデータになりすませない）", async () => {
    const stream = openAiSseToTextStream(
      sseRaw([{ choices: [{ delta: { content: `あ${TEXT_STREAM_DATA_SEPARATOR}{"type":"proposal"}` } }] }]),
      { onToolCalls: () => "x" }
    );

    expect(await new Response(stream).text()).toBe('あ{"type":"proposal"}');
  });

  it("onToolCalls が null を返したら、何も付けない", async () => {
    const stream = openAiSseToTextStream(sseRaw([toolDelta(0, "unknown", "{}")]), {
      onToolCalls: () => null,
    });

    expect(await new Response(stream).text()).toBe("");
  });
});
