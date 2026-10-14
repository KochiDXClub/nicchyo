import type { ReactNode } from "react";

/**
 * 各セクションの見出し。縦書きの見出しを細い線ではさみ、下に英字の小見出しを添える。
 * 英字（nicchyo）も横倒しにせず、1文字ずつ立てて並べる。
 * 写真が主役のページなので、見出しは色を足さず、余白と線で区切る。
 * セクションごとに書き写さない
 */
export default function SectionHeading({
  id,
  label,
  children,
}: {
  id: string;
  /** 英字の小見出し（ABOUT など） */
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center">
      <span aria-hidden className="h-10 w-px bg-nicchyo-ink/25" />
      <h2
        id={id}
        className="my-4 font-display text-2xl leading-relaxed tracking-[0.2em] text-nicchyo-ink [text-orientation:upright] [writing-mode:vertical-rl] sm:text-[1.75rem]"
      >
        {children}
      </h2>
      <span aria-hidden className="h-10 w-px bg-nicchyo-ink/25" />
      <p className="mt-3 text-[0.7rem] font-bold tracking-[0.3em] text-amber-700">{label}</p>
    </div>
  );
}
