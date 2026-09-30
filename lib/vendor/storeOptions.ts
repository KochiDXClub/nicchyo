import type { PaymentMethod, RainPolicy } from "@/app/vendor/_types";

// 店舗情報の選択肢。店舗情報の編集画面（app/vendor/store）と、
// 出店者ページの「にちよさんの質問」で同じ一覧を使う。
// 別々に持つと、片方だけ増やしたときに保存値と表示がずれる。

export const PAYMENT_OPTIONS: { key: PaymentMethod; label: string; emoji: string }[] = [
  { key: "cash",   label: "現金",      emoji: "💴" },
  { key: "card",   label: "カード",    emoji: "💳" },
  { key: "paypay", label: "PayPay",   emoji: "📱" },
  { key: "ic",     label: "交通系IC", emoji: "🚃" },
];

export const RAIN_OPTIONS: { key: RainPolicy; label: string; desc: string }[] = [
  { key: "outdoor",  label: "雨でも出店",              desc: "雨天でも通常通り出店" },
  { key: "cancel",   label: "雨天中止",                desc: "雨天時は出店しない" },
  { key: "undecided",label: "当日判断（SNSで告知）",   desc: "当日SNSで告知" },
];

/** 営業時間の選択肢。日曜市は早朝から始まるので 5:00 から選べる */
export const TIME_OPTIONS = Array.from({ length: 20 }, (_, i) => `${i + 5}:00`);
