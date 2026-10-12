import type { ConsultAskResponse, ConsultAskStreamEvent } from "../types/consultConversation";

/** /api/grandma/ask の本文。失敗時は reply が無いこともあるので、すべて任意として読む */
export type ConsultAskPayload = Partial<ConsultAskResponse>;

export type ConsultAskReadResult = {
  payload: ConsultAskPayload;
  /** HTTP として成功したか。失敗なら errorCode が無くても system_error として扱う */
  ok: boolean;
};

/**
 * 相談 API に stream: true で聞いたときの応答を読む。
 *
 * 答えを作るときは行区切りの JSON（application/x-ndjson）で、途中経過のあとに final が来る。
 * ストリームを始める前に答えが決まる相談（お店が見つからない・質問が短すぎるなど）は、
 * ふつうの JSON 1つで返ってくる（app/api/grandma/ask/handler.ts）。
 * これを行として読むと final が無いので、中身が届いていても「返答の取得に失敗しました」になってしまう。
 *
 * 返す ok は HTTP の成否だけを表す。相談としての成否は payload の errorCode で決まり
 * （ok: true でも no_result などが入る）、それを失敗として扱うのは呼び出し側（normalizeAskResponse）。
 * final が来なかったときは null を返す。
 */
export async function readConsultAskResponse(
  response: Response,
  onEvent?: (event: ConsultAskStreamEvent) => void
): Promise<ConsultAskReadResult | null> {
  if (!response.ok) {
    return { payload: (await response.json()) as ConsultAskPayload, ok: false };
  }
  if (!response.headers.get("content-type")?.includes("application/x-ndjson")) {
    return { payload: (await response.json()) as ConsultAskPayload, ok: true };
  }
  if (!response.body) {
    throw new Error("stream body not found");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  // handleLine の中で書き換えるので、null に絞り込ませない
  let finalResponse = null as ConsultAskResponse | null;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const event = JSON.parse(trimmed) as ConsultAskStreamEvent;
    onEvent?.(event);
    if (event.type === "final") {
      finalResponse = event.response;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(handleLine);
  }

  const trailing = buffer.trim();
  if (trailing) {
    handleLine(trailing);
  }

  return finalResponse ? { payload: finalResponse, ok: true } : null;
}
