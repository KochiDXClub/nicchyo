import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * 各セクションの見出し。話し言葉の短い一言にして、飾りは付けない。
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
    <h2
      id={id}
      className={cn("text-2xl font-black leading-snug text-nicchyo-ink md:text-3xl", align === "center" && "text-center", className)}
    >
      {children}
    </h2>
  );
}
