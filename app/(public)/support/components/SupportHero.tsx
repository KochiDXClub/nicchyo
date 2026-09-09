"use client";

import type { CSSProperties } from "react";
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

/**
 * 前列に立つ人。ここに挙げていない話し手は後列に回る。
 *
 * 話し手が増えたときに誰も消えないよう、前列だけを名指しして、残りは自動で
 * 後ろへ送る形にしてある。
 */
const FRONT_ROW_IDS: readonly string[] = ["nichiyosan", "yosakochan"];

/**
 * 人ごとの微調整。
 *
 * scale は基準の幅にかける倍率。イラストによって、絵の中で人物が占める割合も
 * 周りの透明な余白の入り方も違うので、同じ幅で並べても同じ大きさには見えない。
 * 基準の幅は並びの側が CSS 変数（--hero-char-w）で持ち、ここでは倍率だけを持つ。
 * こうしておくと、倍率を増やすたびに Tailwind のクラス文字列を足さずに済む。
 *
 * nudgeX は transform なので、並びの幅を変えずにその人だけを動かせる。
 * margin で寄せると中央そろえが効いて、隣の人まで一緒に動いてしまう。
 */
const HERO_TUNING: Record<string, { scale?: number; nudgeX?: string }> = {
  nichiyosan: { scale: 1.3 },
  yoichisan: { scale: 1.3, nudgeX: "translate-x-3 sm:translate-x-4 lg:translate-x-6" },
  miraikun: { scale: 1.1, nudgeX: "-translate-x-2 sm:-translate-x-3 lg:-translate-x-4" },
};

const HERO_CAST = CONSULT_CHARACTERS.map((character, index) => ({ character, index }));
const frontRow = HERO_CAST.filter(({ character }) => FRONT_ROW_IDS.includes(character.id));
const backRow = HERO_CAST.filter(({ character }) => !FRONT_ROW_IDS.includes(character.id));

/**
 * 1人ぶん。
 *
 * 出方は「1秒ほどかけて、静かに浮かび上がる」。跳ねさせたり弾ませたりすると、
 * 集合写真ではなくゲームの演出に見える。動かすのは透明度だけにして、
 * 位置と大きさは最初から最後まで動かさない。
 */
function HeroCharacter({
  character,
  appearIndex,
  className,
  reduceMotion,
}: {
  character: (typeof CONSULT_CHARACTERS)[number];
  appearIndex: number;
  className?: string;
  reduceMotion: boolean;
}) {
  const { scale = 1, nudgeX } = HERO_TUNING[character.id] ?? {};

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.9,
        ease: "easeOut",
        // ひとりずつ。前の人が出きる前に次が始まる程度にずらす
        delay: 0.15 + appearIndex * 0.2,
      }}
    >
      <Image
        src={character.image}
        alt=""
        width={512}
        height={512}
        priority
        draggable={false}
        // いちばん大きい人に合わせておく。小さい人が少し多めに読むだけで害はない
        sizes="(min-width: 1024px) 200px, (min-width: 640px) 170px, 145px"
        style={{ "--hero-char-scale": scale } as CSSProperties}
        className={`h-auto w-[calc(var(--hero-char-w)_*_var(--hero-char-scale))] select-none object-contain ${nudgeX ?? ""}`}
      />
    </motion.div>
  );
}

type SupportHeroProps = {
  monthlyLabel: string;
  /** これまでにいただいた総額 */
  totalReceivedLabel: string;
  runwayLabel: string;
  totalMonths: number;
};

export default function SupportHero({
  monthlyLabel,
  totalReceivedLabel,
  runwayLabel,
  totalMonths,
}: SupportHeroProps) {
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

          {/*
            判断に要る3つの数字。囲まずに罫線でそろえる。
            かかる額 → いただいた額 → あと何ヶ月もつか、の順に読ませる
          */}
          <motion.dl
            {...fadeUp(0.5)}
            className="mt-9 grid max-w-[34rem] grid-cols-3 divide-x divide-nicchyo-ink/10 border-y border-nicchyo-ink/10"
          >
            <div className="py-4 pr-3 sm:pr-5">
              <dt className="text-[11px] leading-snug tracking-[0.08em] text-nicchyo-ink/45">
                毎月の運営費
              </dt>
              <dd className="mt-1.5 text-[1.2rem] font-bold leading-none tabular-nums sm:text-[1.45rem]">
                {monthlyLabel}
              </dd>
            </div>
            <div className="py-4 pl-3 pr-3 sm:pl-5 sm:pr-5">
              <dt className="text-[11px] leading-snug tracking-[0.08em] text-nicchyo-ink/45">
                これまでのご支援
              </dt>
              <dd className="mt-1.5 text-[1.2rem] font-bold leading-none tabular-nums sm:text-[1.45rem]">
                {totalReceivedLabel}
              </dd>
            </div>
            <div className="py-4 pl-3 sm:pl-5">
              <dt className="text-[11px] leading-snug tracking-[0.08em] text-nicchyo-ink/45">
                支えていただいている期間
              </dt>
              <dd className="mt-1.5 text-[1.2rem] font-bold leading-none tabular-nums sm:text-[1.45rem]">
                {runwayLabel}
                {/* 狭い画面では「/ 12ヶ月」が途中で折れるので、下の行へ回す */}
                <span className="mt-1 block text-[11px] font-bold text-nicchyo-ink/35 sm:ml-1 sm:mt-0 sm:inline sm:text-[12px]">
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

          横一列ではなく2列にする。後列を広めに、前列を狭めて重ねると、
          整列した記念写真ではなく、寄り集まった一団に見える。
        */}
        {/*
          両列とも中央でそろえる。左右のどちらかに寄せると、列の幅が違うぶん
          片側だけがはみ出して、集合写真の形が崩れる
        */}
        <div
          className="order-first flex flex-col items-center [--hero-char-w:110px] sm:[--hero-char-w:130px] lg:order-none lg:[--hero-char-w:154px]"
          aria-hidden
        >
          {/* 後列。前列よりわずかに広く、肩が両脇からのぞくくらいに留める */}
          <div className="flex items-end justify-center">
            {backRow.map(({ character, index }, position) => (
              <HeroCharacter
                key={character.id}
                character={character}
                appearIndex={index}
                className={position > 0 ? "-ml-6 sm:-ml-8 lg:-ml-10" : undefined}
                reduceMotion={!!prefersReducedMotion}
              />
            ))}
          </div>

          {/* 前列。後列に重ねて手前に置く。重なり量は絵の高さのおよそ4割 */}
          <div className="relative z-10 -mt-[4.5rem] flex items-end justify-center sm:-mt-[5.5rem] lg:-mt-[6.5rem]">
            {frontRow.map(({ character, index }, position) => (
              <HeroCharacter
                key={character.id}
                character={character}
                appearIndex={index}
                className={position > 0 ? "-ml-14 sm:-ml-16 lg:-ml-20" : undefined}
                reduceMotion={!!prefersReducedMotion}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
