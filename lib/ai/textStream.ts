/**
 * OpenAI の Chat Completions のストリーム（SSE）を、答えの文字だけを流すストリームに直す。
 *
 * 店舗ページのチャット（/api/grandma/shop-chat）と出店者の相談（/api/vendor/help-chat）が
 * 同じ形で返すので、読み方をここにまとめる。
 */

/** 答えの文字をそのまま流すレスポンスのヘッダー */
export const TEXT_STREAM_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-cache",
  "X-Accel-Buffering": "no",
} as const;

type FinishInfo = {
  /** OpenAI からの受け取りが途中で失敗した、または利用者側で切れた */
  truncated: boolean;
};

/** モデルが呼ぼうとした関数。arguments は JSON 文字列のまま（検証は呼び出し側） */
export type StreamedToolCall = {
  name: string;
  arguments: string;
};

/**
 * 答えの本文のあとに付け足す、本文以外のデータの区切り文字。
 * 本文側からは取り除くので、受け取る側はこれで安全に切り分けられる
 */
export const TEXT_STREAM_DATA_SEPARATOR = "\u001e";

type Options = {
  /**
   * 流し終わったあと（途中で切れたときも）に、それまでの答えの全文を渡す。
   * 記録などに使う。ここで失敗しても、利用者への答えには影響させない
   */
  onFinish?: (text: string, info: FinishInfo) => Promise<void> | void;
  /**
   * モデルが関数を呼ぼうとしたとき、最後まで受け取れた場合だけ呼ぶ。
   * 返した文字列は区切り文字のあとに付けて流す（null なら何も付けない）
   */
  onToolCalls?: (calls: StreamedToolCall[]) => string | null;
};

export function openAiSseToTextStream(
  upstream: ReadableStream<Uint8Array>,
  { onFinish, onToolCalls }: Options = {}
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.getReader();
  let cancelled = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      let text = "";
      let failed = false;
      // 関数呼び出しは断片で届くので、index ごとにつなぐ
      const toolCalls: StreamedToolCall[] = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const choice = JSON.parse(data).choices?.[0]?.delta;
              const content: unknown = choice?.content;
              const delta =
                typeof content === "string" ? content.split(TEXT_STREAM_DATA_SEPARATOR).join("") : "";
              if (delta) {
                text += delta;
                controller.enqueue(encoder.encode(delta));
              }
              if (Array.isArray(choice?.tool_calls)) collectToolCalls(toolCalls, choice.tool_calls);
            } catch {
              // 壊れた断片は飛ばす
            }
          }
        }
      } catch {
        // OpenAI からの受け取りが途中で失敗した
        failed = true;
      }
      if (!failed && !cancelled && onToolCalls && toolCalls.length > 0) {
        try {
          const trailer = onToolCalls(toolCalls.filter((c) => c.name));
          if (trailer) controller.enqueue(encoder.encode(TEXT_STREAM_DATA_SEPARATOR + trailer));
        } catch {
          // 付け足しに失敗しても、本文はそのまま返す
        }
      }
      // 記録はレスポンスを閉じる前に済ませる。サーバーレスでは、閉じた時点で
      // 関数が止められて記録が残らないことがあるため
      if (onFinish) {
        try {
          await onFinish(text, { truncated: failed || cancelled });
        } catch {
          // 記録の失敗は答えに影響させない
        }
      }
      try {
        // 途中で失敗したときは、正常に終わったように見せず、利用者側に切れたことを伝える
        if (failed) controller.error(new Error("upstream stream failed"));
        else controller.close();
      } catch {
        // すでに閉じている（利用者側で切れた）
      }
    },
    cancel() {
      cancelled = true;
      // 利用者側で切れたら、OpenAI からの受け取りも止める（無駄なトークンを使わない）
      reader.cancel().catch(() => {});
    },
  });
}

type ToolCallDelta = {
  index?: number;
  function?: { name?: unknown; arguments?: unknown };
};

function collectToolCalls(acc: StreamedToolCall[], deltas: ToolCallDelta[]) {
  for (const d of deltas) {
    const index = d?.index ?? 0;
    // 不正な index で配列を伸ばさない
    if (!Number.isInteger(index) || index < 0 || index > 7) continue;
    const call = (acc[index] ??= { name: "", arguments: "" });
    if (typeof d.function?.name === "string") call.name += d.function.name;
    if (typeof d.function?.arguments === "string") call.arguments += d.function.arguments;
  }
}
