/**
 * WebGL が使えるかの判定（MapLibre GL JS は WebGL が無いと地図を描けない）。
 *
 * maplibre-gl 本体の supported() は v2 以降で無くなったため、canvas で実際に
 * コンテキストを作って確かめる。使ったコンテキストはすぐ手放す。
 */
export function isWebGLAvailable(doc: Document | undefined = typeof document === "undefined" ? undefined : document): boolean {
  if (!doc) return false;
  try {
    const canvas = doc.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return false;
    (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
