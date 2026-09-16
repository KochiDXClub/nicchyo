/**
 * 描き起こした画像の使い回し
 *
 * マップページから離れると map.remove() で MapLibre ごと捨てられるが、
 * このモジュールはページ遷移をまたいで生き続ける。屋台・人影・建物の絵は
 * 「形・色・状態・pixelRatio」だけで中身が決まる（＝同じ鍵なら必ず同じ絵）ので、
 * 一度描いたものを取っておけば、戻ってきたときの描き起こしを丸ごと省ける。
 *
 * 取っておくのは「形で決まる絵」だけ（屋台・人影・建物）。数十枚で収まり、
 * 描き起こしが重いわりに容量が小さいので割が良い。店舗写真の丸窓はここに入れない
 * ——枚数が店舗数ぶんあって容量を食うわりに、元画像はブラウザのキャッシュに
 * 残っており、描き直しも表示の待ちには乗らないため。
 *
 * 日曜市は屋外で歩きながら使うので、端末の記憶容量を抱え込みすぎないよう
 * 合計の大きさに上限を設け、古いものから捨てる。なお、これは「計算を先回りして
 * 走らせる」たぐいの仕組みではない。マップを閉じている間は何も動かず、
 * 次に開いたときの描き起こしが減るだけ。
 */

const MAX_CACHE_BYTES = 8 * 1024 * 1024;

type CacheEntry = { job: Promise<unknown>; bytes: number };

const cache = new Map<string, CacheEntry>();
let cachedBytes = 0;

/**
 * 絵の占める大きさ（RGBA 4 バイト × 画素数）。
 * ImageData かどうかを instanceof で見ないのは、この関数を画面のない場所
 * （テストなど）からも使えるようにするため。
 */
function byteSizeOf(value: unknown): number {
  if (typeof value !== "object" || value === null) return 0;
  const { width, height } = value as { width?: unknown; height?: unknown };
  if (typeof width !== "number" || typeof height !== "number") return 0;
  return width * height * 4;
}

function evictUntilWithinBudget(protectedKey: string): void {
  for (const [key, entry] of cache) {
    if (cachedBytes <= MAX_CACHE_BYTES) return;
    if (key === protectedKey) continue;
    cache.delete(key);
    cachedBytes -= entry.bytes;
  }
}

/**
 * key が同じなら前に描いたものを返す。
 * key には中身を決めるものをすべて入れること（URL・色・寸法・pixelRatio）。
 */
export function memoImage<T>(key: string, make: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) return hit.job as Promise<T>;

  const entry: CacheEntry = {
    bytes: 0,
    job: make()
      .then((value) => {
        // 解決してから実際の大きさを足し込み、はみ出したぶんを古い順に捨てる
        if (cache.get(key) === entry) {
          entry.bytes = byteSizeOf(value);
          cachedBytes += entry.bytes;
          evictUntilWithinBudget(key);
        }
        return value;
      })
      .catch((error: unknown) => {
        // 失敗したものは覚え込まない（次に来たときにやり直す）
        if (cache.get(key) === entry) {
          cache.delete(key);
          cachedBytes -= entry.bytes;
        }
        throw error;
      }),
  };
  cache.set(key, entry);
  return entry.job as Promise<T>;
}

/** テストから使う。ページ遷移では消さない */
export function clearRasterCache(): void {
  cache.clear();
  cachedBytes = 0;
}

/** テスト・デバッグ用 */
export function rasterCacheStats(): { entries: number; bytes: number } {
  return { entries: cache.size, bytes: cachedBytes };
}
