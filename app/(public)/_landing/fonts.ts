import { Yusei_Magic } from "next/font/google";

/**
 * 写真の上に「書かれる」ひとことの手書き書体。トップページの HandNote だけで使う。
 * 使う画面が限られるので先読みはしない（layout.tsx の Mochiy Pop One と同じ方針）
 */
export const handFont = Yusei_Magic({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
