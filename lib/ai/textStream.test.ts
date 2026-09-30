import { describe, expect, it, vi } from "vitest";
import { openAiSseToTextStream } from "./textStream";

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

    expect(onFinish).toHaveBeenCalledWith("投稿はここから");
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
});
