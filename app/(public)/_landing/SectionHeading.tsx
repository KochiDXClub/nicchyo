import type { ReactNode } from "react";

/** 各セクションの見出し（小さな札と、丸文字の見出し）。セクションごとに書き写さない */
export default function SectionHeading({ id, eyebrow, children }: { id: string; eyebrow: string; children: ReactNode }) {
  return (
    <>
      <p className="text-sm font-bold tracking-wide text-amber-700">{eyebrow}</p>
      <h2 id={id} className="mt-2 font-display text-2xl leading-snug text-nicchyo-ink sm:text-3xl">
        {children}
      </h2>
    </>
  );
}
