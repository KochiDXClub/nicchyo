// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { readConsultAskResponse } from "./readConsultAskResponse";
import type { ConsultAskStreamEvent } from "../types/consultConversation";

/** 答えを作るときの応答（app/api/grandma/ask/handler.ts と同じヘッダー）。chunks は届く単位 */
function ndjson(chunks: string[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
}

const finalEvent = {
  type: "final",
  response: { reply: "にちよさん: 野菜なら一丁目やね。", shopIds: [16], consultId: "c-1" },
};

describe("readConsultAskResponse", () => {
  it("ストリームを読み、途中経過を渡して、final の中身を返す（行が届く単位で切れていても読む）", async () => {
    const lines = [
      JSON.stringify({ type: "first_turn_start", speakerId: "nichiyosan", speakerName: "にちよさん" }),
      JSON.stringify({ type: "first_turn_delta", delta: "野菜なら" }),
      JSON.stringify(finalEvent),
    ].join("\n");
    const events: ConsultAskStreamEvent[] = [];

    const result = await readConsultAskResponse(ndjson([lines.slice(0, 50), lines.slice(50)]), (e) => events.push(e));

    expect(events.map((e) => e.type)).toEqual(["first_turn_start", "first_turn_delta", "final"]);
    expect(result).toEqual({ payload: finalEvent.response, ok: true });
  });

  it("ストリームを始める前に決まった答え（お店が見つからない）は、ふつうの JSON として読む", async () => {
    const noResult = {
      reply: "にちよさん: ぴったり当てはまるお店は見つからんかった…",
      errorCode: "no_result",
      errorMessage: "ぴったり当てはまるお店は見つからんかった…",
      retryable: false,
    };
    const onEvent = vi.fn();

    const result = await readConsultAskResponse(NextResponse.json(noResult), onEvent);

    expect(result).toEqual({ payload: noResult, ok: true });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("失敗の応答は ok: false で中身を返す", async () => {
    const error = { reply: "にちよさん: いま少し混みゆうみたい。", errorCode: "system_error", retryable: true };

    const result = await readConsultAskResponse(NextResponse.json(error, { status: 500 }));

    expect(result).toEqual({ payload: error, ok: false });
  });

  it("ストリームが final の前に終わったら null", async () => {
    const result = await readConsultAskResponse(
      ndjson([JSON.stringify({ type: "first_turn_delta", delta: "野菜" }) + "\n"])
    );

    expect(result).toBeNull();
  });
});
