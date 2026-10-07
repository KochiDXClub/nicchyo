import { renderOgImage } from "@/lib/og/renderOgImage";

// /og-map.png として共有カード用の画像を返す（静的ファイルを置く代わりに生成する）
export function GET(request: Request) {
  return renderOgImage(request, "Kochi Sunday Market Map");
}
