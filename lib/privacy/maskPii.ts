// 自由入力テキストに混入した個人情報（メールアドレス・電話番号）をマスクする。
// AI相談の質問文などをDBに保存する前に通す。
// 完全な検出は目的ではなく、うっかり書き込まれた連絡先が
// ログに残り続けるのを防ぐための軽量なマスク。

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// 電話番号の区切りとして書かれがちなハイフン類。NFKC では半角にならないものも含める
// （ハイフン・ダッシュ類 U+2010〜2015、マイナス記号、長音記号「ー」）。
const HYPHENS = "\\-\u2010-\u2015\u2212\u30FC";

// 0始まり、または国際表記（+81）で、区切り（ハイフン類・括弧・空白）を挟み得る数字列の候補。
// 実際に電話番号とみなすかは桁数で判定する。
const PHONE_CANDIDATE_PATTERN = new RegExp(
  `(?<![\\d${HYPHENS}])(?:\\+81[${HYPHENS}()\\s]*|\\(?0)[\\d${HYPHENS}()\\s]{7,13}\\d(?![\\d${HYPHENS}])`,
  "g"
);

function isPhoneNumber(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, "");
  if (candidate.startsWith("+81")) {
    // +81 の後ろは国内番号の先頭の 0 を落とすのが正式だが、
    // 「+81 090-…」「+81 (0)90-…」のように残したまま書かれることも多い
    const national = digits.slice(2);
    const length = national.startsWith("0") ? national.length - 1 : national.length;
    return length === 9 || length === 10;
  }
  return digits.length === 10 || digits.length === 11;
}

// 全角の英数字・記号（U+FF01〜FF5E）と全角スペースを半角に置き換える。
// 1文字を1文字に写すので、元の文字列と位置がそのまま対応する。
function toHalfWidth(text: string): string {
  return text.replace(/[！-～　]/g, (ch) =>
    ch === "　" ? " " : String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
}

type Range = { start: number; end: number; label: string };

export function maskPii(text: string): string {
  // 検出は半角にそろえた写しで行い（０９０、＠、＋ なども拾う）、
  // マスクは元の文字列に当てる。個人情報でない部分の「？」などは書き換えない
  const folded = toHalfWidth(text);
  const ranges: Range[] = [];

  for (const m of folded.matchAll(EMAIL_PATTERN)) {
    ranges.push({ start: m.index, end: m.index + m[0].length, label: "[メールアドレス]" });
  }
  for (const m of folded.matchAll(PHONE_CANDIDATE_PATTERN)) {
    const start = m.index;
    const end = start + m[0].length;
    if (!isPhoneNumber(m[0])) continue;
    // メールアドレスの中の数字列は二重に扱わない
    if (ranges.some((r) => start < r.end && r.start < end)) continue;
    ranges.push({ start, end, label: "[電話番号]" });
  }

  ranges.sort((a, b) => b.start - a.start);
  let result = text;
  for (const { start, end, label } of ranges) {
    result = result.slice(0, start) + label + result.slice(end);
  }
  return result;
}
