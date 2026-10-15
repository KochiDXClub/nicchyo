import type { ReactNode } from "react";

/**
 * 各セクションの見出し。英字の小さな札を上に、日本語の見出しを大きく置く
 * （デザインシステムの「日本語を大きく、英字は小さく字間を空けて上に」）。
 * 見出しは短く、説明はできるだけ添えない。セクションごとに書き写さない
 */
export default function SectionHeading({
  id,
  label,
  children,
}: {
  id: string;
  /** 英字の小見出し（GENRE など） */
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-[0.7rem] font-bold tracking-[0.16em] text-amber-700">{label}</p>
      <h2 id={id} className="mt-1.5 font-display text-2xl leading-snug text-nicchyo-ink">
        {children}
      </h2>
    </div>
  );
}
