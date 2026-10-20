import Link from "next/link";
import { Map } from "lucide-react";

/**
 * 「マップをみる」。画面の右下に常駐する丸いボタン。スクロールしても、いつでも地図をひらける。
 * 地図のアイコンだけだと何のボタンか分かりにくいので、下に短い文字を添える。
 * 下の端末の余白（--safe-bottom）の分だけ上げる
 */
export default function MapFab() {
  return (
    <Link
      href="/map"
      aria-label="マップをみる"
      className="fixed right-4 z-30 flex h-[4.5rem] w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-full bg-amber-600 text-white shadow-float ring-4 ring-white/80 transition duration-200 hover:bg-amber-500 active:scale-95 focus-visible:outline-none focus-visible:ring-amber-300 motion-reduce:transition-none md:right-8 md:h-20 md:w-20"
      style={{ bottom: "calc(1.25rem + var(--safe-bottom, 0px))" }}
    >
      <Map aria-hidden className="h-7 w-7" strokeWidth={2} />
      <span aria-hidden className="text-[11px] font-bold leading-none">
        マップ
      </span>
    </Link>
  );
}
