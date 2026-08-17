// 自由入力テキストに混入した個人情報（メールアドレス・電話番号）をマスクする。
// AI相談の質問文などをDBに保存する前に通す。
// 完全な検出は目的ではなく、うっかり書き込まれた連絡先が
// ログに残り続けるのを防ぐための軽量なマスク。

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// 0始まりで区切り（ハイフン・スペース・括弧）を挟み得る数字列の候補。
// 実際に電話番号とみなすかは桁数（10〜11桁）で判定する。
const PHONE_CANDIDATE_PATTERN = /(?<![\d-])0[\d\-()\s]{8,13}\d(?![\d-])/g;

export function maskPii(text: string): string {
  return text
    .replace(EMAIL_PATTERN, "[メールアドレス]")
    .replace(PHONE_CANDIDATE_PATTERN, (candidate) => {
      const digitCount = candidate.replace(/\D/g, "").length;
      return digitCount === 10 || digitCount === 11 ? "[電話番号]" : candidate;
    });
}
