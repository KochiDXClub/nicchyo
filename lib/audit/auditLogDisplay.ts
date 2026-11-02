/**
 * 監査ログを、コードを読めない運営の人にも分かる言葉に直す。
 *
 * 【設計方針】
 * - 監査ログの action（操作の名前）は、ここの AUDIT_ACTIONS にあるものだけを書ける
 *   （lib/audit/logAdminAudit.ts の型で縛る）。新しい操作を足すときは、ここに表示名を足さないとビルドが通らない。
 * - details は呼び出し元によって JSON と日本語の文が混ざっている。操作ごとに読み方を決め、
 *   知らない形は「項目: 値」に崩して出す。英語のキーや ID はそのまま見せず、「技術的な情報」に寄せる。
 * - 元の値（action・details・ID・IP）は消さずに technical に残す。調べものをする人が困らないように。
 */

import { AI_CONVERSATION_SETTING_DEF_BY_KEY, type AiConversationSettingKey } from "@/lib/ai/conversationSettings";
import { AI_MODEL_DEF_BY_ID, AI_USE_CASE_DEF_BY_KEY, type AiUseCase } from "@/lib/ai/models";
import { LISTING_STATUS_LABELS, type ListingStatus } from "@/lib/admin/shopEdit";
import { getStatusPresentation, type MarketDayStatus } from "@/lib/market/calendar";
import { statusLabel as vendorInquiryStatusLabel } from "@/lib/vendorInquiries/labels";

export type AuditTone = "caution" | "good" | "info" | "neutral";

/** 操作の名前 → 札に出す短い名前と色。消す・止める＝注意、作る・承認＝良い、変える＝情報 */
export const AUDIT_ACTIONS = {
  // 店舗（現場登録・代理編集）
  shop_create: { label: "店舗を登録", tone: "good" },
  shop_edit: { label: "店舗情報を編集", tone: "info" },
  shop_location_edit: { label: "店舗の位置を記録", tone: "info" },
  shop_image_upload: { label: "店舗写真を登録", tone: "info" },
  product_image_upload: { label: "商品写真を登録", tone: "info" },
  product_image_delete: { label: "商品写真を削除", tone: "caution" },
  bulk_delete: { label: "店舗を一括削除", tone: "caution" },
  bulk_suspend: { label: "店舗を一括停止", tone: "caution" },
  bulk_restore: { label: "店舗を一括復活", tone: "good" },
  shop_claim_issue: { label: "店舗のQRを発行", tone: "good" },
  shop_claim_unlink: { label: "店舗との紐づけを解除", tone: "caution" },
  shop_invite_create: { label: "店舗への招待を作成", tone: "good" },
  shop_invite_revoke: { label: "店舗への招待を取り消し", tone: "caution" },
  // マップ編集
  map_edit_save_vendors: { label: "マップ編集で出店者を保存", tone: "info" },
  map_edit_delete_vendors_attempt: { label: "マップ編集で出店者の削除を開始", tone: "caution" },
  map_edit_delete_vendors: { label: "マップ編集で出店者を削除", tone: "caution" },
  map_view_settings_updated: { label: "地図の表示設定を変更", tone: "info" },
  spot_created: { label: "地図の目印を追加", tone: "good" },
  spot_updated: { label: "地図の目印を編集", tone: "info" },
  spot_deleted: { label: "地図の目印を削除", tone: "caution" },
  // カテゴリー
  category_created: { label: "カテゴリーを作成", tone: "good" },
  category_updated: { label: "カテゴリーを変更", tone: "info" },
  category_deleted: { label: "カテゴリーを削除", tone: "caution" },
  // 日曜市カレンダー
  market_day_updated: { label: "開催日の状態を変更", tone: "info" },
  event_created: { label: "イベントを作成", tone: "good" },
  event_updated: { label: "イベントを編集", tone: "info" },
  event_deleted: { label: "イベントを削除", tone: "caution" },
  event_image_uploaded: { label: "イベント画像を登録", tone: "info" },
  // ユーザー
  invite_user: { label: "ユーザーを招待", tone: "good" },
  invite_user_role_set_failed: { label: "招待したユーザーのロール設定に失敗", tone: "caution" },
  change_role: { label: "ユーザーのロールを変更", tone: "info" },
  suspend_user: { label: "ユーザーを停止", tone: "caution" },
  restore_user: { label: "ユーザーを復帰", tone: "good" },
  bulk_delete_user: { label: "ユーザーを一括削除", tone: "caution" },
  bulk_suspend_user: { label: "ユーザーを一括停止", tone: "caution" },
  bulk_restore_user: { label: "ユーザーを一括復帰", tone: "good" },
  // 受信トレイ・お知らせ
  inquiry_status_changed: { label: "問い合わせの状態を変更", tone: "info" },
  vendor_inquiry_status_changed: { label: "出店者からの相談の状態を変更", tone: "info" },
  vendor_inquiry_replied_as_city: { label: "出店者からの相談に返信", tone: "good" },
  report_status_changed: { label: "通報の状態を変更", tone: "info" },
  announcement_create: { label: "サイト内のお知らせを投稿", tone: "good" },
  announcement_update: { label: "サイト内のお知らせを編集", tone: "info" },
  announcement_delete: { label: "サイト内のお知らせを削除", tone: "caution" },
  vendor_notice_created: { label: "出店者へのお知らせを送信", tone: "good" },
  vendor_notice_deleted: { label: "出店者へのお知らせを削除", tone: "caution" },
  broadcast_email: { label: "お知らせメールを送信", tone: "good" },
  // AI・システム
  ai_model_updated: { label: "AIのモデルを変更", tone: "info" },
  ai_conversation_setting_updated: { label: "AIの会話設定を変更", tone: "info" },
  clean_map_history: { label: "古いマップ履歴を整理", tone: "caution" },
  delete_analytics: { label: "アクセス記録を全削除", tone: "caution" },
} as const satisfies Record<string, { label: string; tone: AuditTone }>;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

/** 今は書かれないが、過去の記録に残っているかもしれない操作の名前 */
const LEGACY_ACTIONS: Record<string, { label: string; tone: AuditTone }> = {
  user_created: { label: "ユーザーを作成", tone: "good" },
  user_updated: { label: "ユーザーを更新", tone: "info" },
  user_deleted: { label: "ユーザーを削除", tone: "caution" },
  user_role_changed: { label: "ユーザーのロールを変更", tone: "info" },
  shop_created: { label: "店舗を作成", tone: "good" },
  shop_updated: { label: "店舗を更新", tone: "info" },
  shop_deleted: { label: "店舗を削除", tone: "caution" },
  shop_approved: { label: "店舗を承認", tone: "good" },
  shop_suspended: { label: "店舗を停止", tone: "caution" },
  bulk_operation: { label: "一括操作", tone: "info" },
  data_export: { label: "データを書き出し", tone: "neutral" },
  login: { label: "ログイン", tone: "neutral" },
  logout: { label: "ログアウト", tone: "neutral" },
};

function actionInfo(action: string): { label: string; tone: AuditTone } {
  return (
    (AUDIT_ACTIONS as Record<string, { label: string; tone: AuditTone }>)[action] ??
    LEGACY_ACTIONS[action] ?? { label: "その他の操作", tone: "neutral" }
  );
}

/** 対象の種類（target_type）→ 日本語 */
const TARGET_TYPE_LABELS: Record<string, string> = {
  vendor: "店舗",
  shop: "店舗",
  category: "カテゴリー",
  user: "ユーザー",
  market_event: "イベント",
  market_event_image: "イベント画像",
  market_day: "開催日",
  map_landmark: "地図の目印",
  map_view_settings: "地図の表示設定",
  inquiry: "問い合わせ",
  vendor_inquiry: "出店者からの相談",
  report: "通報",
  announcement: "サイト内のお知らせ",
  vendor_notice: "出店者へのお知らせ",
  email: "メール",
  system: "システム",
  ai_use_cases: "AIのモデル設定",
  ai_conversation_settings: "AIの会話設定",
};

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "最高管理者",
  admin: "管理者",
  moderator: "モデレーター",
  vendor: "出店者",
  general_user: "一般ユーザー",
  user: "一般ユーザー",
};

export function roleLabel(role: string | null): string | null {
  if (!role) return null;
  return ROLE_LABELS[role] ?? role;
}

/** 店舗の代理編集で変えた項目（列名）→ 管理画面の店舗詳細と同じ呼び名 */
const SHOP_FIELD_LABELS: Record<string, string> = {
  shop_name: "店名",
  category_id: "カテゴリー",
  style: "出店スタイル",
  strength: "こだわり",
  main_products: "主な商品",
  main_product_prices: "商品の価格",
  payment_methods: "決済方法",
  rain_policy: "雨天時",
  sns_instagram: "Instagram",
  sns_x: "X",
  sns_hp: "ホームページ",
  business_hours_start: "営業開始時刻",
  business_hours_end: "営業終了時刻",
  shop_image_url: "店舗写真",
  listing_status: "掲載許可",
  photo_use_allowed: "写真の使用",
  listing_consented_on: "許可をもらった日",
  listing_consent_note: "許可のメモ",
  owner_name: "店主名",
  chome: "丁目",
};

/** JSON の details に出てくるキー → 日本語。知らないキーは「その他」にまとめる */
const DETAIL_KEY_LABELS: Record<string, string> = {
  name: "名前",
  title: "タイトル",
  status: "状態",
  count: "件数",
  sender: "送り主",
  important: "重要",
  body: "本文",
  category: "種類",
  fields: "変えた項目",
  requested: "発行しようとした数",
  issued: "発行した数",
  maxUses: "使える回数",
  value: "値",
  note: "メモ",
};

const REPORT_STATUS_LABELS: Record<string, string> = {
  open: "未対応",
  in_review: "確認中",
  resolved: "対応済み",
  dismissed: "対応不要",
};

const INQUIRY_STATUS_LABELS: Record<string, string> = {
  open: "未対応",
  in_progress: "対応中",
  resolved: "解決済み",
  closed: "クローズ",
};

const REASONING_EFFORT_LABELS: Record<string, string> = {
  none: "考えない",
  minimal: "ごく浅く",
  low: "浅く",
  medium: "ふつう",
  high: "深く",
  xhigh: "とても深く",
  max: "最大",
};

export type AuditLogRecord = {
  action: string;
  actor_email: string | null;
  actor_role: string | null;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  details: string | null;
  ip_address: string | null;
};

export type AuditFact = { label: string; value: string };

export type AuditLogView = {
  /** 札に出す短い名前 */
  actionLabel: string;
  tone: AuditTone;
  /** 「何をしたか」を一文で */
  summary: string;
  /** 対象の種類（「店舗」など）。分からなければ null */
  targetLabel: string | null;
  /** 読める形にした詳細 */
  facts: AuditFact[];
  /** 調べもの用の元の値（操作の名前・ID・元の details・IP） */
  technical: AuditFact[];
};

type Json = Record<string, unknown>;

function parseJson(details: string | null): Json | null {
  if (!details) return null;
  const trimmed = details.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const value: unknown = JSON.parse(trimmed);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
  } catch {
    return null;
  }
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const quote = (name: string | null) => (name ? `「${name}」` : "");

/** 名前の並びを「A、B、C ほか N件」に縮める */
function listNames(names: string[], max = 5): string {
  if (names.length <= max) return names.join("、");
  return `${names.slice(0, max).join("、")} ほか${names.length - max}件`;
}

function namesOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (v && typeof v === "object" ? str((v as Json).name) ?? str((v as Json).shop_name) : str(v)))
    .filter((v): v is string => v !== null);
}

/** 値を人が読める文字にする。ID っぽいもの・入れ子の中身は出さない */
function readableValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "はい" : "いいえ";
  if (typeof value === "number") return value.toLocaleString("ja-JP");
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const names = namesOf(value);
    if (names.length > 0) return listNames(names);
    return `${value.length}件`;
  }
  return null;
}

/** 知らない形の JSON を「項目: 値」に崩す。ID や英語のキーは出さない */
function genericFacts(json: Json): AuditFact[] {
  const facts: AuditFact[] = [];
  for (const [key, value] of Object.entries(json)) {
    if (/(^id$|Id$|_id$)/.test(key)) continue;
    const label = DETAIL_KEY_LABELS[key];
    const readable = readableValue(value);
    if (label && readable) facts.push({ label, value: readable });
  }
  return facts;
}

function fieldNames(keys: string[]): string {
  return keys.map((k) => SHOP_FIELD_LABELS[k] ?? "その他の項目").filter((v, i, a) => a.indexOf(v) === i).join("、");
}

/** 「代理編集: shop_name, chome=3 / 掲載許可 pending → allowed」を読む */
function shopEditFacts(details: string | null): AuditFact[] {
  if (!details) return [];
  const facts: AuditFact[] = [];
  for (const part of details.split(" / ")) {
    const edited = part.match(/^代理編集:\s*(.*)$/);
    if (edited) {
      const keys = edited[1].split(",").map((s) => s.trim()).filter(Boolean);
      const chome = keys.find((k) => k.startsWith("chome="));
      const fields = fieldNames(keys.map((k) => (k.startsWith("chome=") ? "chome" : k)));
      // 書く側はフォームで送った項目をすべて記録している（実際に値が変わったかは分からない）ので「保存した項目」と呼ぶ
      if (fields) facts.push({ label: "保存した項目", value: fields });
      if (chome) facts.push({ label: "丁目", value: chome.slice("chome=".length) || "なし" });
      continue;
    }
    const consent = part.match(/^掲載許可\s+(\S+)\s*→\s*(\S+)$/);
    if (consent) {
      const label = (s: string) => LISTING_STATUS_LABELS[s as ListingStatus] ?? s;
      facts.push({ label: "掲載許可", value: `${label(consent[1])} → ${label(consent[2])}` });
      continue;
    }
    facts.push({ label: "内容", value: part });
  }
  return facts;
}

/** 文の中のロールの英語（ロール: vendor など）を日本語にする */
function replaceRoleWords(text: string): string {
  return text.replace(/(ロール[:：]?\s*|ロールを\s*)([a-z_]+)\s*/g, (_, prefix: string, role: string) => `${prefix}${roleLabel(role)}`);
}

function marketStatusLabel(status: unknown): string | null {
  const s = str(status);
  if (!s) return null;
  return getStatusPresentation(s as MarketDayStatus)?.label ?? s;
}

type Described = { summary: string; facts: AuditFact[] };

/** 操作ごとの読み方。ここに無い操作は、札の名前と崩した詳細で出す */
function describeByAction(log: AuditLogRecord, json: Json | null): Described | null {
  const name = log.target_name;
  const text = json ? null : log.details;
  switch (log.action) {
    case "shop_create":
      return { summary: `店舗${quote(name)}を現場で新しく登録しました`, facts: text ? [{ label: "メモ", value: text }] : [] };
    case "shop_edit":
      return { summary: `店舗${quote(name)}の情報を代わりに編集しました`, facts: shopEditFacts(log.details) };
    case "shop_location_edit":
      return { summary: `店舗${quote(name)}の位置を記録しました`, facts: text ? [{ label: "内容", value: text }] : [] };
    case "shop_image_upload":
      return { summary: `店舗${quote(name)}の写真を代わりに登録しました`, facts: [] };
    case "product_image_upload":
    case "product_image_delete": {
      const product = text?.split(": ").slice(1).join(": ") || null;
      const verb = log.action === "product_image_upload" ? "登録" : "削除";
      return {
        summary: `店舗${quote(name)}の商品写真を代わりに${verb}しました`,
        facts: product ? [{ label: "商品", value: product }] : [],
      };
    }
    case "map_edit_save_vendors": {
      const created = namesOf(json?.created);
      const updated = namesOf(json?.updated);
      const facts: AuditFact[] = [];
      if (created.length > 0) facts.push({ label: `新しく作った出店者（${created.length}件）`, value: listNames(created) });
      if (updated.length > 0) facts.push({ label: `更新した出店者（${updated.length}件）`, value: listNames(updated) });
      return { summary: `マップ編集で出店者を保存しました（新規 ${created.length}件・更新 ${updated.length}件）`, facts };
    }
    case "map_edit_delete_vendors_attempt":
    case "map_edit_delete_vendors": {
      const vendors = namesOf(json?.vendors);
      const count = typeof json?.count === "number" ? json.count : vendors.length;
      const done = log.action === "map_edit_delete_vendors";
      return {
        summary: done
          ? `マップ編集で出店者を${count}件削除しました`
          : `マップ編集で出店者${count}件の削除を始めました（このあと「削除」の記録が無ければ、削除はされていません）`,
        facts: vendors.length > 0 ? [{ label: "対象の出店者", value: listNames(vendors) }] : [],
      };
    }
    case "category_created":
      return { summary: `カテゴリー${quote(str(json?.name))}を作りました`, facts: [] };
    case "category_updated":
      return { summary: `カテゴリーの名前を${quote(str(json?.name))}に変えました`, facts: [] };
    case "category_deleted":
      return { summary: `カテゴリー${quote(str(json?.name))}を削除しました`, facts: [] };
    case "market_day_updated": {
      const before = (json?.before ?? null) as Json | null;
      const after = (json?.after ?? null) as Json | null;
      const facts: AuditFact[] = [];
      const from = marketStatusLabel(before?.status);
      const to = marketStatusLabel(after?.status);
      if (to) facts.push({ label: "開催の状態", value: from && from !== to ? `${from} → ${to}` : to });
      const note = str(after?.note);
      if (note) facts.push({ label: "お知らせの文", value: note });
      return { summary: `${log.target_id ?? ""} の開催の状態を変えました`.trim(), facts };
    }
    case "event_created":
      return { summary: `イベント${quote(str(json?.title))}を作りました`, facts: [] };
    case "event_updated":
      return {
        summary: `イベント${quote(str(json?.title))}を編集しました`,
        facts: json ? genericFacts(json) : [],
      };
    case "event_deleted":
      return { summary: "イベントを削除しました", facts: [] };
    case "event_image_uploaded": {
      const size = typeof json?.size === "number" ? `${Math.round(json.size / 1024).toLocaleString("ja-JP")} KB` : null;
      return { summary: "イベントの画像を登録しました", facts: size ? [{ label: "大きさ", value: size }] : [] };
    }
    case "spot_created":
      return { summary: `地図の目印${quote(str(json?.name))}を追加しました`, facts: [] };
    case "spot_updated":
      return { summary: "地図の目印を編集しました", facts: [] };
    case "spot_deleted":
      return { summary: "地図の目印を削除しました", facts: [] };
    case "invite_user":
    case "invite_user_role_set_failed":
      return {
        summary:
          log.action === "invite_user"
            ? `${name ?? "ユーザー"}を招待しました`
            : `${name ?? "ユーザー"}を招待しましたが、ロールの設定に失敗しました`,
        facts: text ? [{ label: "内容", value: replaceRoleWords(text) }] : [],
      };
    case "change_role": {
      const role = text?.match(/ロールを\s*([a-z_]+)\s*に変更/)?.[1];
      return { summary: role ? `ユーザーのロールを「${roleLabel(role)}」に変えました` : "ユーザーのロールを変えました", facts: [] };
    }
    case "inquiry_status_changed": {
      const status = str(json?.status);
      const facts: AuditFact[] = [];
      if (status) facts.push({ label: "状態", value: INQUIRY_STATUS_LABELS[status] ?? status });
      if (typeof json?.has_reply === "boolean") facts.push({ label: "返信のメモ", value: json.has_reply ? "あり" : "なし" });
      return { summary: "問い合わせの状態を変えました", facts };
    }
    case "vendor_inquiry_status_changed": {
      const from = str(json?.from);
      const to = str(json?.to);
      const label = (s: string) => vendorInquiryStatusLabel(s).label;
      return {
        summary: "出店者からの相談の状態を変えました",
        facts: to ? [{ label: "状態", value: from ? `${label(from)} → ${label(to)}` : label(to) }] : [],
      };
    }
    case "vendor_inquiry_replied_as_city":
      return { summary: "出店者からの相談に、運営として返信しました", facts: [] };
    case "report_status_changed": {
      const status = str(json?.status);
      const facts: AuditFact[] = [];
      if (status) facts.push({ label: "状態", value: REPORT_STATUS_LABELS[status] ?? status });
      const notes = str(json?.resolution_notes);
      if (notes) facts.push({ label: "対応のメモ", value: notes });
      return { summary: "通報の状態を変えました", facts };
    }
    case "vendor_notice_created":
    case "vendor_notice_deleted": {
      const facts: AuditFact[] = [];
      const sender = str(json?.sender);
      if (sender) facts.push({ label: "送り主", value: sender });
      if (json?.important === true) facts.push({ label: "重要", value: "はい" });
      return {
        summary: `出店者へのお知らせ${quote(name)}を${log.action === "vendor_notice_created" ? "送りました" : "削除しました"}`,
        facts,
      };
    }
    case "ai_model_updated": {
      const useCase = AI_USE_CASE_DEF_BY_KEY.get(log.target_id as AiUseCase)?.label ?? null;
      const modelId = str(json?.modelId);
      const model = modelId ? AI_MODEL_DEF_BY_ID.get(modelId)?.label ?? modelId : null;
      const effort = str(json?.reasoningEffort);
      const facts: AuditFact[] = [];
      if (model) facts.push({ label: "モデル", value: model });
      if (effort) facts.push({ label: "考える深さ", value: REASONING_EFFORT_LABELS[effort] ?? effort });
      return { summary: `${useCase ? `「${useCase}」の` : ""}AIのモデルを変えました`, facts };
    }
    case "ai_conversation_setting_updated": {
      const setting = AI_CONVERSATION_SETTING_DEF_BY_KEY.get(log.target_id as AiConversationSettingKey)?.label ?? null;
      const value = readableValue(json?.value);
      return {
        summary: `AIの会話設定${setting ? `「${setting}」` : ""}を変えました`,
        facts: value ? [{ label: "新しい値", value }] : [],
      };
    }
    case "map_view_settings_updated":
      return { summary: "地図の表示設定（最初に映す範囲など）を変えました", facts: [] };
    default:
      return null;
  }
}

/** 監査ログ1件を、画面に出す形にする */
export function describeAuditLog(log: AuditLogRecord): AuditLogView {
  const { label, tone } = actionInfo(log.action);
  const json = parseJson(log.details);
  const described = describeByAction(log, json);

  const targetLabel = log.target_type ? TARGET_TYPE_LABELS[log.target_type] ?? null : null;
  const summary =
    described?.summary ??
    `${label}${log.target_name ? `（${targetLabel ?? "対象"}${quote(log.target_name)}）` : ""}`;
  const facts =
    described?.facts ??
    (json ? genericFacts(json) : log.details ? [{ label: "内容", value: replaceRoleWords(log.details) }] : []);

  const technical: AuditFact[] = [{ label: "操作の名前", value: log.action }];
  if (log.target_type) technical.push({ label: "対象の種類", value: log.target_type });
  if (log.target_id) technical.push({ label: "対象のID", value: log.target_id });
  if (log.details) technical.push({ label: "記録された内容（そのまま）", value: log.details });
  if (log.ip_address) technical.push({ label: "IPアドレス", value: log.ip_address });

  return { actionLabel: label, tone, summary, targetLabel, facts, technical };
}
