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

type Options = {
  /**
   * 流し終わったあと（途中で切れたときも）に、それまでの答えの全文を渡す。
   * 記録などに使う。ここで失敗しても、利用者への答えには影響させない
   */
  onFinish?: (text: string) => Promise<void> | void;
};

export function openAiSseToTextStream(
  upstream: ReadableStream<Uint8Array>,
  { onFinish }: Options = {}
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.getReader();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      let text = "";
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
        // 利用者が画面を閉じたなどで読めなくなった。ここまでの答えで終える
      } finally {
        try {
          controller.close();
        } catch {
          // すでに閉じている（利用者側で切れた）
        }
        if (onFinish) {
          try {
            await onFinish(text);
          } catch {
            // 記録の失敗は答えに影響させない
          }
        }
      }
    },
    cancel() {
      // 利用者側で切れたら、OpenAI からの受け取りも止める（無駄なトークンを使わない）
      reader.cancel().catch(() => {});
    },
  });
}
