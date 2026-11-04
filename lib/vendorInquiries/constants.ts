// 出店者連絡機能（vendor_inquiries）の共通定数・バリデーション。
// supabase/migrations/20260830100000_create_vendor_inquiries.sql のCHECK制約と値域を揃えること。
// DB側のCHECK制約が最終防衛だが、APIでも同じ値域を検証して分かりやすいエラーメッセージを返す。

export const VENDOR_INQUIRY_TOPICS = ["question", "report", "consultation"] as const;
export type VendorInquiryTopic = (typeof VENDOR_INQUIRY_TOPICS)[number];

export const VENDOR_INQUIRY_CATEGORIES = ["city", "operator", "both"] as const;
export type VendorInquiryCategory = (typeof VENDOR_INQUIRY_CATEGORIES)[number];

export const VENDOR_INQUIRY_URGENCIES = ["low", "normal", "high"] as const;
export type VendorInquiryUrgency = (typeof VENDOR_INQUIRY_URGENCIES)[number];

export const VENDOR_INQUIRY_REPLY_SENDER_ROLES = ["vendor", "operator", "city"] as const;
export type VendorInquiryReplySenderRole = (typeof VENDOR_INQUIRY_REPLY_SENDER_ROLES)[number];

// topic="report"（報告・連絡）は #470 の設計上「返信を前提としない一方向の共有」だが、
// 返信API自体はtopicで制限していない。運営が「確認しました」と一言返せる方が親切なため、
// APIとDBでは許容し、返信フォームを出すかどうかはUI側（#473/#474）の判断に委ねる。
// 出店者側UIではreportに返信欄を出さない想定。

// vendor_inquiries_status_matches_topic 制約と同じ対応表
export const VENDOR_INQUIRY_STATUS_BY_TOPIC: Record<VendorInquiryTopic, readonly string[]> = {
  report: ["unconfirmed", "confirmed"],
  consultation: ["unhandled", "in_progress", "resolved"],
  question: ["ai_pending", "ai_resolved", "escalated", "human_answered"],
};

// 運営がまだ対応していない（受信トレイのバッジ・ダッシュボードの「未対応」に数える）status。
// 出店者から連絡が来て、運営が確認・回答するまでの状態をtopicをまたいで集めたもの。
// report: 未確認 / consultation: 未対応・検討中 / question: 確認待ち・担当者に取次ぎ中
export const VENDOR_INQUIRY_OPEN_STATUSES = [
  "unconfirmed",
  "unhandled",
  "in_progress",
  "ai_pending",
  "escalated",
] as const;

export const VENDOR_INQUIRY_BODY_MAX_LENGTH = 4000;
export const VENDOR_INQUIRY_REPLY_BODY_MAX_LENGTH = 4000;
export const VENDOR_INQUIRY_IMAGE_URL_MAX_LENGTH = 2048;

/** このプロジェクトのSupabaseのホスト。取れなければ https の画像URLは一切許可しない */
function supabaseStorageHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).host;
  } catch {
    return null;
  }
}

/**
 * image_url に許可する形式か判定する。
 * サイト内の絶対パスと、このプロジェクトのSupabase Storageのhttps URLのみ許可する。
 *
 * サイト内絶対パスの判定は「先頭が `/` で、かつ2文字目が `/` でも `\` でもない」こと。
 * `//evil.example/a.png` はプロトコル相対URLで外部ホストを指し、
 * `/\evil.example/a.png` もブラウザが `//` に正規化するため同じく外部ホストを指す。
 *
 * あわせて制御文字を含む値を拒否する。ブラウザはURLを解釈する前にタブ・LF・CRを
 * 取り除くため（WHATWG URL 仕様）、残したまま判定すると `/<TAB>/evil.example/a.png` が
 * `//evil.example/a.png` として外部ホストを指してしまう。`.trim()` が落とすのは
 * 前後だけなので、途中に入った制御文字はここで弾く必要がある。
 *
 * **この検証を表示側の安全性の根拠にしてはいけない。**
 * vendor_inquiries の INSERT ポリシーは `with check (auth.uid() = vendor_id)` だけで、
 * image_url の形はDB側で縛っていない。出店者はこのAPIを通さず PostgREST から
 * 直接任意の値を入れられる。表示側（#473/#474）では必ず再検証・エスケープすること。
 */
export function isAllowedVendorInquiryImageUrl(
  value: string,
  // 既定はこのプロジェクトのSupabaseホスト。テストからは明示的に渡す
  allowedStorageHost: string | null = supabaseStorageHost()
): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > VENDOR_INQUIRY_IMAGE_URL_MAX_LENGTH) return false;
  // 範囲は必ずエスケープ表記で書くこと。制御文字そのものをソースに入れると
  // git がファイルをバイナリと判定し、差分が読めなくなる（#527 で一度起きた）
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return false;

  if (/^\/(?![/\\])/.test(trimmed)) return true;

  // ホストは前方一致ではなく完全一致で見る。`*.supabase.co` をまるごと許すと
  // 他人のSupabaseプロジェクトの画像も指定できてしまう
  if (!allowedStorageHost) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" && url.host === allowedStorageHost;
  } catch {
    return false;
  }
}

export function isValidStatusForTopic(topic: VendorInquiryTopic, status: string): boolean {
  return VENDOR_INQUIRY_STATUS_BY_TOPIC[topic]?.includes(status) ?? false;
}

// 全topicを通じて取りうるstatus値の集合（一覧APIのフィルタ検証用）
const ALL_VENDOR_INQUIRY_STATUSES = new Set(Object.values(VENDOR_INQUIRY_STATUS_BY_TOPIC).flat());

export function isVendorInquiryStatus(value: string): boolean {
  return ALL_VENDOR_INQUIRY_STATUSES.has(value);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isVendorInquiryTopic(value: string): value is VendorInquiryTopic {
  return (VENDOR_INQUIRY_TOPICS as readonly string[]).includes(value);
}

export function isVendorInquiryCategory(value: string): value is VendorInquiryCategory {
  return (VENDOR_INQUIRY_CATEGORIES as readonly string[]).includes(value);
}

export function isVendorInquiryUrgency(value: string): value is VendorInquiryUrgency {
  return (VENDOR_INQUIRY_URGENCIES as readonly string[]).includes(value);
}
