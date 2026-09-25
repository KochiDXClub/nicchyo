/**
 * 構造化出力（response_format: json_schema）の返事を読む
 *
 * 素の JSON.parse だと、モデルが正しいオブジェクトを1つ書き終えたあとに
 * 余計な文字を足しただけで返事全体が捨てられる。GPT-6 Luna は推論なし（none）で
 * これが起きることが報告されている（同じオブジェクトをもう1つ書く、
 * 「Need valid JSON…」のような文を足す等。長い system prompt で1〜2%程度）。
 *
 * 先頭のオブジェクトはモデルの本来の答えなので、それだけを取り出して使う。
 * 途中で切れた JSON（finish_reason=length）は直さない。欠けた内容を補うと
 * 設定ミス（出力上限の絞りすぎ）が見えなくなるため、従来どおり例外にする。
 */

/**
 * 返事の先頭にある JSON オブジェクトを1つ読む。
 * オブジェクトが最後まで閉じていなければ SyntaxError を投げる。
 */
export function parseFirstJsonObject(raw: string): unknown {
  const text = raw.trim();
  try {
    return JSON.parse(text);
  } catch (error) {
    const end = findFirstObjectEnd(text);
    if (end === -1) throw error;
    return JSON.parse(text.slice(0, end));
  }
}

/** 先頭の `{` に対応する `}` の直後の位置。閉じていなければ -1 */
function findFirstObjectEnd(text: string): number {
  if (!text.startsWith("{")) return -1;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}
