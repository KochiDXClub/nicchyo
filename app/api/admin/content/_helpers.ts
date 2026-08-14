// /api/admin/content 系で使う純粋な検証ロジック。
// Next.js の Request/cookies に依存しない部分だけを切り出してユニットテスト可能にする。

// PATCH で許可する遷移先。deleted への遷移は誤操作防止のため DELETE 経由に限定し、
// ここでは扱わない（完全削除とは別の軽量モデレーション手段として hidden を用意）。
export const PATCHABLE_STATUSES = ["active", "hidden"] as const;
export type PatchableStatus = (typeof PATCHABLE_STATUSES)[number];

export function isPatchableStatus(value: unknown): value is PatchableStatus {
  return typeof value === "string" && (PATCHABLE_STATUSES as readonly string[]).includes(value);
}
