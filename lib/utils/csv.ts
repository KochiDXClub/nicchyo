/**
 * CSV 文字列を作る（BOM 付き UTF-8。Excel で文字化けしない）。
 *
 * 先頭が = + - @ タブ 改行 のセルは、Excel が数式として実行してしまう
 * （CSV インジェクション）ので、先頭に ' を付けて文字列にする。
 */
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const lines = [
    columns.map(escape).join(","),
    ...rows.map((row) => columns.map((h) => escape(row[h])).join(",")),
  ];
  return "﻿" + lines.join("\r\n");
}
