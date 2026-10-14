"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * 画面に入ったら、下からふわっと出す。写真の上の文字を、スクロールに合わせて見せるのに使う。
 *
 * - center … 要素が画面の中央の帯（上下 40% を除いた所）に来たら出す。読み進めて「ここまで来た」ところで出したいとき
 * - enter  … 少しでも見えたら出す。最初の画面のように、開いた時点で見えているもの
 *
 * 一度出したら戻さない。動きを減らす設定のときは、動かさずに切り替える（出るタイミングは同じ）。
 * IntersectionObserver が無いときは最初から出しておく
 */
export default function RevealOnScroll({
  children,
  className,
  when = "center",
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  when?: "center" | "enter";
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      when === "center" ? { rootMargin: "-40% 0px -40% 0px" } : { threshold: 0.2 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [when]);

  return (
    <div
      ref={ref}
      className={cn(
        "transition duration-700 ease-out-soft motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        className
      )}
      style={{ transitionDelay: shown ? `${delayMs}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
