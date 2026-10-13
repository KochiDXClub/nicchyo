/**
 * 答えの文字を少しずつ流すレスポンス（lib/ai/textStream.ts が作る形）を読み、
 * 届いた分ずつ onChunk に渡す。画面ごとに同じ読み取りを書かないための共通部分。
 */
export async function readTextStream(body: ReadableStream<Uint8Array>, onChunk: (chunk: string) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) onChunk(chunk);
  }
}
