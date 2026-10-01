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

type Options = {
  /**
   * 流し終わったあと（途中で切れたときも）に、それまでの答えの全文を渡す。
   * 記録などに使う。ここで失敗しても、利用者への答えには影響させない
   */
  onFinish?: (text: string, info: FinishInfo) => Promise<void> | void;
};

export function openAiSseToTextStream(
  upstream: ReadableStream<Uint8Array>,
  { onFinish }: Options = {}
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
              const delta: string = JSON.parse(data).choices?.[0]?.delta?.content ?? "";
              if (delta) {
                text += delta;
                controller.enqueue(encoder.encode(delta));
              }
            } catch {
              // 壊れた断片は飛ばす
            }
          }
        }
      } catch {
        // OpenAI からの受け取りが途中で失敗した
        failed = true;
      } finally {
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
      }
    },
    cancel() {
      cancelled = true;
      // 利用者側で切れたら、OpenAI からの受け取りも止める（無駄なトークンを使わない）
      reader.cancel().catch(() => {});
    },
  });
}
