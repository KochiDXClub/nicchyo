"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Map } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * 「マップをみる」。画面の右下に出る丸いボタン。
 * afterId の要素（最初の画面）が画面の上へ出ていったら出す。最初の画面には大きなボタンがあるので、重ねて出さない。
 * 地図のアイコンだけだと何のボタンか分かりにくいので、下に短い文字を添える。
 * 下の端末の余白（--safe-bottom）の分だけ上げる。IntersectionObserver が無い環境では、最初から出す
 */
export default function MapFab({ afterId }: { afterId: string }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const target = document.getElementById(afterId);
    if (!target || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      // 見えなくなり、かつ上へ出ていったときだけ出す（ページの読み込み直後の「まだ見えていない」では出さない）
      setShown(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [afterId]);

  return (
    <Link
      href="/map"
      aria-label="マップをみる"
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      className={cn(
        "fixed right-4 z-30 flex h-32 w-32 flex-col items-center justify-center gap-1 rounded-full bg-amber-600 text-white shadow-float ring-[6px] ring-white/80 transition duration-300 hover:bg-amber-500 active:scale-95 focus-visible:outline-none focus-visible:ring-amber-300 motion-reduce:transition-none md:right-8 md:h-36 md:w-36",
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      )}
      style={{ bottom: "calc(1.25rem + var(--safe-bottom, 0px))" }}
    >
      <Map aria-hidden className="h-12 w-12 md:h-14 md:w-14" strokeWidth={2} />
      <span aria-hidden className="text-base font-bold leading-none md:text-lg">
        マップ
      </span>
    </Link>
  );
}
