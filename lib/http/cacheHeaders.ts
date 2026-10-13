/**
 * 公開してよい API レスポンスの Cache-Control を作る。
 * 文字列を各 route に直書きすると、秒数の書き間違いや書式のばらつきが出るので、ここで組み立てる。
 */
export function publicCacheHeaders(options: {
  /** ブラウザが再利用してよい秒数 */
  maxAgeSeconds?: number;
  /** CDN が再利用してよい秒数 */
  sMaxAgeSeconds: number;
  /** 期限切れのあとも、裏で更新しながら古い内容を返してよい秒数 */
  staleWhileRevalidateSeconds?: number;
}): { "Cache-Control": string } {
  const parts = ["public"];
  if (options.maxAgeSeconds !== undefined) parts.push(`max-age=${options.maxAgeSeconds}`);
  parts.push(`s-maxage=${options.sMaxAgeSeconds}`);
  if (options.staleWhileRevalidateSeconds !== undefined) {
    parts.push(`stale-while-revalidate=${options.staleWhileRevalidateSeconds}`);
  }
  return { "Cache-Control": parts.join(", ") };
}
