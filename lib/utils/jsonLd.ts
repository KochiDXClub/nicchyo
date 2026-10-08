/**
 * JSON-LD を `<script type="application/ld+json">` に埋め込むための安全なシリアライズ。
 *
 * `JSON.stringify` は `<` や `/` をエスケープしないため、DB 由来（出店者が編集可能）の
 * 文字列に `</script>` が含まれると script タグが早期終了し、格納型 XSS になる。
 * HTML の解釈上意味を持つ文字を Unicode エスケープに変換して無害化する。
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(
    /[<>&]/g,
    (char) => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}
