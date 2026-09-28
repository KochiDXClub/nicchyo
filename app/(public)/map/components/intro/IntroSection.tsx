'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * デモを1つ抱えた区画。縦に積んで、上から順に読めるようにする。
 *
 * 見出しの下には、にちよさんと吹き出しが入るぶんの場所だけ空けておく。
 * 中身（絵と言葉）はレール側が1組だけ持っていて、その場所まで降りてくる。
 *
 * デモは節が画面に入ったときに一度だけ、下からふわりと現れる。
 * 節ごとに止まるスクロールと合わせて、1節が1枚のスライドとして立ち上がる。
 */
export default function IntroSection({
  index,
  step,
  title,
  stopRef,
  stopHeight,
  viewportRoot,
  children,
}: {
  index: number;
  step: string;
  title: string;
  stopRef: (el: HTMLDivElement | null) => void;
  stopHeight: number;
  viewportRoot: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    /* 道（絶対配置の SVG）より手前に置く。relative を付けないと、
       位置指定のない中身のほうが下に潜って、文字の上を道が横切る。
       snap-start / snap-always で、この節の先頭がスクロールの止まる位置になる */
    <section
      data-intro-stop={index}
      className="relative z-[1] snap-start snap-always border-t border-nicchyo-ink/[0.07] pb-9 pt-8 md:py-11"
    >
      <div className="flex items-center gap-2.5 pl-[var(--intro-rail)] pr-5 md:pr-8">
        <span className="inline-flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-full bg-nicchyo-primary px-1 text-[11.5px] font-extrabold tracking-wider text-white shadow-[0_4px_10px_-4px_rgba(126,217,87,0.9)]">
          {step}
        </span>
        <h3 className="text-[20px] font-extrabold leading-tight tracking-tight text-nicchyo-ink md:text-[22px]">
          {title}
        </h3>
      </div>
      {/* にちよさんの停留点。高さだけ確保しておく */}
      <div ref={stopRef} className="mt-3" style={{ height: stopHeight }} />
      {/*
        スマホはデモを端まで使う（地図は広いほうがよい）。
        PC は見出しと左端を揃え、右端はダイアログの余白に揃える。
      */}
      <motion.div
        className="mt-3 px-5 md:pl-[var(--intro-rail)] md:pr-8"
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ root: viewportRoot, once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </section>
  );
}
