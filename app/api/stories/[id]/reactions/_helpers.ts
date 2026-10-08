// /api/stories/[id]/reactions で使う純粋な検証ロジック。
// Next.js の Request/cookies に依存しない部分だけを切り出してユニットテスト可能にする。

// visitorKey の受理条件は ask/route.ts に倣う（空でない・128文字以内）
export function normalizeVisitorKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const vk = raw.trim();
  return vk.length > 0 && vk.length <= 128 ? vk : null;
}

// vendor_contents.id（UUID）の形式チェック。不正な値を弾いておかないと
// Postgres の型エラーがそのまま500として露出してしまう（レビュー指摘対応）
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidContentId(id: string): boolean {
  return UUID_PATTERN.test(id);
}
