/**
 * CSV の文字列を行の配列にする（RFC 4180 相当）。
 * - 先頭の BOM（Excel で保存した UTF-8 CSV に付く）を取り除く
 * - ダブルクォートで囲んだ値の中のカンマ・改行・""（"の表現）に対応する
 * - 改行は CRLF / LF / CR のどれでもよい
 * - 末尾の空行と、値がすべて空の行は捨てる
 */
export function parseCsv(text: string): string[][] {
  return parseCsvWithLines(text).rows;
}

/**
 * parseCsv と同じ読み方で、各行がファイルの何行目から始まるか（1 始まり）も返す。
 * 値がすべて空の行を捨てたり、クォートの中の改行を1行にまとめたりしても、エラーの行番号が
 * 実際のファイルの行とずれないようにするため。
 */
export function parseCsvWithLines(text: string): { rows: string[][]; lines: number[] } {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  const lines: number[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let lineNo = 1;
  let rowStartLine = 1;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((value) => value.trim() !== "")) {
      rows.push(row);
      lines.push(rowStartLine);
    }
    row = [];
  };

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n" || (ch === "\r" && input[i + 1] !== "\n")) lineNo += 1;
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === ",") {
      endField();
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      endRow();
      lineNo += 1;
      rowStartLine = lineNo;
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) endRow();
  return { rows, lines };
}

/**
 * CSV ファイルの中身（バイト列）を文字列にする。まず UTF-8 として読み、UTF-8 として読めなければ Shift_JIS で読み直す。
 * 日本語版 Excel の標準の「CSV (コンマ区切り)」は Shift_JIS で保存されるため。
 */
export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("shift_jis").decode(buffer);
  }
}
