import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import InView from "./InView";

/**
 * 各セクションの見出し。話し言葉の短い一言にして、画面に入ると、蛍光ペンのような黄色い下線が左から引かれる。
 * 英字の小見出しは置かない（日本語の見出しだけで伝える）。説明は添えない
 */
export default function SectionHeading({
  id,
  children,
  className,
  align = "left",
}: {
  id: string;
  children: ReactNode;
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <InView once className={cn(align === "center" ? "text-center" : "", className)}>
      <h2 id={id} className="relative inline-block font-display text-2xl leading-snug text-nicchyo-ink md:text-3xl">
        {children}
        <svg
          viewBox="0 0 200 12"
          preserveAspectRatio="none"
          aria-hidden
          className="landing-scrib pointer-events-none absolute -bottom-3 -left-1 h-3 w-[calc(100%+0.75rem)] overflow-visible"
        >
          <path pathLength="1" d="M3 7C25 1 40 11 62 6S100 2 122 7S165 11 197 4" />
        </svg>
      </h2>
    </InView>
  );
}
