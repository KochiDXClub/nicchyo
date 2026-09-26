// 出店者連絡機能の画面表示用ラベルと、報告・連絡の定型パターン定義。
// 値域そのものは constants.ts（DBのCHECK制約と対応）を正とし、ここでは表示だけを扱う。

import type {
  VendorInquiryCategory,
  VendorInquiryReplySenderRole,
  VendorInquiryTopic,
  VendorInquiryUrgency,
} from "./constants";

export const TOPIC_LABELS: Record<VendorInquiryTopic, { label: string; description: string; emoji: string }> = {
  question: {
    label: "質問",
    description: "分からないことを聞く",
    emoji: "❓",
  },
  report: {
    label: "報告・連絡",
    description: "決まったことを伝える",
    emoji: "📢",
  },
  consultation: {
    label: "相談",
    description: "やり取りしながら決める",
    emoji: "💬",
  },
};

export const CATEGORY_LABELS: Record<VendorInquiryCategory, string> = {
  city: "高知市役所",
  operator: "nicchyo運営",
  both: "市役所と運営の両方",
};

export const URGENCY_LABELS: Record<VendorInquiryUrgency, { label: string; description: string }> = {
  low: { label: "急がない", description: "時間があるときで大丈夫" },
  normal: { label: "ふつう", description: "数日のうちに知りたい" },
  high: { label: "急ぎ", description: "今週中に返事がほしい" },
};

export const SENDER_ROLE_LABELS: Record<VendorInquiryReplySenderRole, string> = {
  vendor: "あなた",
  operator: "nicchyo運営",
  city: "高知市役所",
};

// status は topic ごとに意味が違う（constants.ts の VENDOR_INQUIRY_STATUS_BY_TOPIC 参照）。
// 出店者から見て分かる言葉にする。
export const STATUS_LABELS: Record<string, { label: string; tone: "waiting" | "progress" | "done" }> = {
  // report
  unconfirmed: { label: "未確認", tone: "waiting" },
  confirmed: { label: "確認済み", tone: "done" },
  // consultation
  unhandled: { label: "未対応", tone: "waiting" },
  in_progress: { label: "検討中", tone: "progress" },
  resolved: { label: "回答済み", tone: "done" },
  // question
  ai_pending: { label: "AIが対応中", tone: "progress" },
  ai_resolved: { label: "解決済み", tone: "done" },
  escalated: { label: "担当者に取次ぎ中", tone: "progress" },
  human_answered: { label: "回答済み", tone: "done" },
};

export function statusLabel(status: string): { label: string; tone: "waiting" | "progress" | "done" } {
  return STATUS_LABELS[status] ?? { label: status, tone: "waiting" };
}

/**
 * 報告・連絡の定型パターン。
 *
 * vendor_inquiries には body（text）しか無く構造化カラムが無いため、ここで選んだ
 * パターンと追加入力は buildReportBody() で本文に整形して埋め込む。
 * 将来テーブルに構造化カラムを足す場合は、この定義を列の定義に移すことになる。
 */
export type ReportPatternField = {
  name: string;
  label: string;
  type: "text" | "date" | "textarea";
  placeholder?: string;
  required?: boolean;
};

export type ReportPattern = {
  id: string;
  label: string;
  /** 宛先。運営が仲介するものは operator、市役所の判断が要るものは city */
  category: VendorInquiryCategory;
  fields: ReportPatternField[];
};

export const REPORT_PATTERNS: ReportPattern[] = [
  {
    id: "last_day",
    label: "出店を最後にする",
    category: "both",
    fields: [
      { name: "last_date", label: "最終出店予定日", type: "date", required: true },
      { name: "reason", label: "理由（任意）", type: "textarea", placeholder: "差し支えなければ教えてください" },
    ],
  },
  {
    id: "absence",
    label: "しばらく出店を休む",
    category: "both",
    fields: [
      { name: "from_date", label: "休み始める日", type: "date", required: true },
      { name: "to_date", label: "再開予定日（未定なら空欄）", type: "date" },
      { name: "reason", label: "理由（任意）", type: "textarea" },
    ],
  },
  {
    id: "shop_info_changed",
    label: "店名・商品が変わった",
    category: "operator",
    fields: [
      { name: "changed", label: "変わった内容", type: "textarea", placeholder: "例：店名を「〇〇」に変えました", required: true },
    ],
  },
  {
    id: "contact_changed",
    label: "連絡先が変わった",
    category: "both",
    fields: [
      { name: "new_contact", label: "新しい連絡先", type: "text", placeholder: "電話番号やメールアドレス", required: true },
    ],
  },
  {
    id: "other",
    label: "その他の報告",
    category: "operator",
    fields: [],
  },
];

export function findReportPattern(id: string): ReportPattern | undefined {
  return REPORT_PATTERNS.find((p) => p.id === id);
}

/**
 * 定型パターンの選択と入力を、運営が読んで分かる本文に整形する。
 * DBに構造化カラムが無いため、本文の先頭に「何の報告か」が分かる形で埋め込む。
 */
export function buildReportBody(
  pattern: ReportPattern,
  values: Record<string, string>,
  freeText: string
): string {
  const lines = [`【${pattern.label}】`];

  for (const field of pattern.fields) {
    const value = values[field.name]?.trim();
    if (!value) continue;
    // ラベルから「（任意）」等の注釈を落として見出しにする
    const heading = field.label.replace(/（.*?）/g, "").trim();
    lines.push(`${heading}: ${value}`);
  }

  const trimmedFreeText = freeText.trim();
  if (trimmedFreeText) {
    lines.push("", trimmedFreeText);
  }

  return lines.join("\n");
}
