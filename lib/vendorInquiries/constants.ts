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

export const VENDOR_INQUIRY_BODY_MAX_LENGTH = 4000;
export const VENDOR_INQUIRY_REPLY_BODY_MAX_LENGTH = 4000;

/**
 * image_url に許可する形式か判定する。
 * サイト内の絶対パスと、Supabase Storageのhttps URLのみ許可する
 * （next.config.js の remotePatterns が *.supabase.co に限定しているのと同じ方針）。
 *
 * サイト内絶対パスの判定は「先頭が `/` で、かつ2文字目が `/` でも `\` でもない」こと。
 * `//evil.example/a.png` はプロトコル相対URLで外部ホストを指す。
 * `/\evil.example/a.png` もブラウザが `//` に正規化するため同じく外部ホストを指すので、
 * バックスラッシュも併せて弾く必要がある。
 *
 * この検証はスレッド作成時（POST /api/vendor/inquiries）の一度きりで、
 * 保存後の表示時には再検証されない。表示側（#473/#474）はDBに入っている
 * image_url がここを通過した値であることを前提にしてよい。
 */
export function isAllowedVendorInquiryImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (/^\/(?![/\\])/.test(trimmed)) return true;
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\//i.test(trimmed);
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
