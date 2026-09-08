"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { CONSULT_CHARACTERS } from "@/app/(public)/consult/data/consultCharacters";

/**
 * ページの入口
 *
 * 上半分をイラストと余白だけにすると絵は気持ちよく収まるが、このページの読者は
 * 協賛を検討する企業と助成金の審査員なので、結論（いくらかかっていて、いま
 * どこまで支えていただけているか）を最初に置く。スクロールしなくても判断に
 * 必要な数字が揃っている状態にしておく。
 *
 * 動きはここに集中させる。見出しが1行ずつ上から落ちてくるところがこのページで
 * いちばん派手な瞬間で、それ以外は Reveal の控えめな浮き上がりだけにする。
 */

/**
 * 見出しは文節ごとに1行。
 *
 * 日本語は語中でも折り返すので、素のままだと幅によって「みなさ／まの」のように
 * 切れる。行を固定してしまえばその心配が無くなり、1行ずつ落とす演出もできる。
 * どの幅でもこの3行に収まることは確認済み（いちばん長い行で12文字）。
 */
const HEADLINE_LINES = ["この地図は、", "みなさまのご支援のもとで", "成り立っております。"];

type SupportHeroProps = {
  monthlyLabel: string;
  runwayLabel: string;
  totalMonths: number;
};

export default function SupportHero({ monthlyLabel, runwayLabel, totalMonths }: SupportHeroProps) {
  const prefersReducedMotion = useReducedMotion();

  /** 入口の要素を、上から順に少しずつ遅らせて出す */
  const fadeUp = (delay: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const, delay },
        };

  return (
    <section className="relative isolate overflow-hidden">
      {/* 地の色から立ち上がる暖色。境目を作らないよう下端でベース色に溶かす */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_82%_0%,#FDECC8_0%,rgba(253,236,200,0)_58%)]" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-amber-50/70 via-nicchyo-base/40 to-nicchyo-base" />

      <div className="mx-auto grid max-w-[64rem] items-center gap-8 px-6 pb-14 pt-12 sm:px-8 lg:grid-cols-[1.25fr_0.75fr] lg:gap-12 lg:pb-20 lg:pt-16">
        <div>
          <motion.p
            {...fadeUp(0.05)}
            className="text-[11px] font-bold tracking-[0.2em] text-amber-700/80"
          >
            協賛・ご支援について
          </motion.p>

          <h1 className="mt-5 text-[1.6rem] font-bold leading-[1.5] tracking-tight sm:text-[2rem] lg:text-[2.3rem]">
            {HEADLINE_LINES.map((line, index) => (
              // 窓の外から落とすので、行ごとに overflow-hidden で覆う。
              // 下の余白は、はみ出す字（ら・す の下端）が切れないぶんだけ
              <span key={line} className="block -mb-[0.14em] overflow-hidden pb-[0.14em]">
                <motion.span
                  className="inline-block"
                  initial={prefersReducedMotion ? false : { y: "-115%" }}
                  animate={{ y: 0 }}
                  transition={{
                    duration: 0.62,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.12 + index * 0.085,
                  }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            {...fadeUp(0.42)}
            className="mt-5 max-w-[33rem] text-[14.5px] leading-[2] text-nicchyo-ink/60 [text-wrap:pretty]"
          >
            高知・日曜市を案内する nicchyo は、高知高専の学生と顧問の教員が運営しております。広告は掲載せず、これまでいただいた賞金とご支援で続けてまいりました。
          </motion.p>

          {/* 判断に要る2つの数字。囲まずに罫線でそろえる */}
          <motion.dl
            {...fadeUp(0.5)}
            className="mt-9 flex max-w-[30rem] divide-x divide-nicchyo-ink/10 border-y border-nicchyo-ink/10"
          >
            <div className="flex-1 py-4 pr-5">
              <dt className="text-[11px] tracking-[0.08em] text-nicchyo-ink/45">毎月の運営費</dt>
              <dd className="mt-1.5 text-[1.55rem] font-bold leading-none tabular-nums">
                {monthlyLabel}
              </dd>
            </div>
            <div className="flex-1 py-4 pl-5">
              <dt className="text-[11px] tracking-[0.08em] text-nicchyo-ink/45">
                ご支援いただいている期間
              </dt>
              <dd className="mt-1.5 text-[1.55rem] font-bold leading-none tabular-nums">
                {runwayLabel}
                <span className="ml-1.5 text-[13px] font-bold text-nicchyo-ink/35">
                  / {totalMonths}ヶ月
                </span>
              </dd>
            </div>
          </motion.dl>

          <motion.div
            {...fadeUp(0.58)}
            className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3"
          >
            <Link
              href="/contact?category=sponsor"
              className="inline-flex items-center justify-center rounded-2xl bg-nicchyo-ink px-7 py-3.5 text-[14.5px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(58,58,58,0.55)] transition hover:bg-nicchyo-ink/90 active:scale-[0.99]"
            >
              協賛のご相談
            </Link>
            <a
              href="#costs"
              className="text-[13px] font-bold text-nicchyo-ink/45 underline-offset-4 transition hover:text-nicchyo-ink/75 hover:underline"
            >
              費用の内訳を見る
            </a>
          </motion.div>
        </div>

        {/*
          4人そろえて並べる。ひとりだけだと「学生がひとりで作っている」に見えるが、
          並んでいると、支えている人が何人もいることが絵として伝わる。
          少しずつ重ねて肩を寄せた形にして、等間隔に整列させない。
          手前から順に にちよさん、以降は後ろに回す（このページの顔は彼女）
        */}
        <div
          className="order-first flex items-end justify-center lg:order-none lg:justify-end"
          aria-hidden
        >
          {CONSULT_CHARACTERS.map((character, index) => (
            <motion.div
              key={character.id}
              className="relative -ml-6 first:ml-0 sm:-ml-8 lg:-ml-10"
              style={{ zIndex: CONSULT_CHARACTERS.length - index }}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 18, scale: 0.92 }}
              // 奇数番目をわずかに下げる。横一線に並ぶと整列した記念写真になる
              animate={{ opacity: 1, y: index % 2 === 1 ? 7 : 0, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 22,
                // ひとりずつ出す。4人で 0.6 秒ほどに収める
                delay: 0.18 + index * 0.13,
              }}
            >
              <Image
                src={character.image}
                alt=""
                width={512}
                height={512}
                priority
                draggable={false}
                sizes="(min-width: 1024px) 118px, (min-width: 640px) 100px, 84px"
                className="h-auto w-[84px] select-none object-contain sm:w-[100px] lg:w-[118px]"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
