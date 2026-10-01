/**
 * 文字のまま流れてくる答え（lib/ai/textStream の openAiSseToTextStream が返すもの）を、
 * 届いた分ずつ受け取りながら最後まで読む。画面側で「書きながら出す」ために使う。
 *
 * onText には、そこまでに届いた全文を渡す（差分ではない）。戻り値は最後までの全文。
 */
export async function readTextStream(
  body: ReadableStream<Uint8Array>,
  onText: (received: string) => void
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let received = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += decoder.decode(value, { stream: true });
    onText(received);
  }
  return received + decoder.decode();
}
