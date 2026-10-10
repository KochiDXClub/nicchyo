"use client";

import { useState } from "react";
import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { buttonClass } from "@/components/ui";

/**
 * 活動の様子のギャラリー
 *
 * 写真を横一列に並べ、ゆっくり左へ流し続ける。学生のプロジェクトにお金を出すかを
 * 決める人に、実際に日曜市へ通っている人がいることを、文章より先に見せる。
 *
 * 流し続けるのは5秒を超える動きなので、止めるボタンを必ず置く（WCAG 2.2.2）。
 * カーソルを乗せているあいだと、中の要素を選んでいるあいだも止まる。
 * 動きを減らす設定では流さず、指やスクロールで横に送れる一列にする（globals.css）。
 *
 * 途切れなく回すため、同じ並びを2回続けて置き、ちょうど半分まで送ったら最初に戻す。
 * 2回目の並びは飾りなので、読み上げからは外す。
 */

type GalleryPhoto = {
  src: string;
  /** 何が写っているか。写真だけで伝えたいことを1文で */
  alt: string;
};

/**
 * 並べる写真。
 *
 * 人が写っているものは、取り組みの記録（/activities）で既に公開しているものに限る。
 * 新しく足すときは、写っている方の了解を取ってから足すこと。
 */
const GALLERY_PHOTOS: GalleryPhoto[] = [
  {
    src: "/images/activities/2025-10-19-sunday-market-survey.webp",
    alt: "日曜市で、高知高専の学生が来訪者アンケートを行っている様子",
  },
  { src: "/images/intro/sunday-market-street-crowd.webp", alt: "買い物客でにぎわう日曜市の通り" },
  {
    src: "/images/activities/2026-03-17-kochi-city-meeting-3.jpg",
    alt: "高知市商業振興課の街路市担当の方々との会談の様子",
  },
  { src: "/images/intro/sunday-market-street-stalls.webp", alt: "のぼりと屋台が並ぶ日曜市の通り" },
  { src: "/images/activities/2026-02-28-kochi-npo-award.jpg", alt: "こうちNPOアワード2025の会場の様子" },
  { src: "/images/home-hero.jpg", alt: "野菜や品物が並ぶ日曜市の屋台" },
  {
    src: "/images/activities/2026-01-24-re-kosen-final-presentation.jpg",
    alt: "re-KOSEN最終報告会で発表する様子",
  },
  { src: "/images/intro/sunday-market-otepia-overview.webp", alt: "上から見た日曜市の通り" },
];

/** 1枚あたり何秒で流すか。枚数が増えても速さが変わらないよう、全体の長さはこれから出す */
const SECONDS_PER_PHOTO = 7;

export default function SupportGallery() {
  const [isPaused, setIsPaused] = useState(false);
  const loop = [...GALLERY_PHOTOS, ...GALLERY_PHOTOS];

  return (
    <div className="support-gallery" data-paused={isPaused || undefined}>
      <div className="support-gallery__viewport overflow-hidden">
        <ul
          className="support-gallery__track flex w-max"
          style={{ animationDuration: `${GALLERY_PHOTOS.length * SECONDS_PER_PHOTO}s` }}
        >
          {loop.map((photo, index) => {
            const isCopy = index >= GALLERY_PHOTOS.length;
            return (
              // 間隔は gap ではなく右の余白で取る。gap だと並びの半分の位置が
              // 余白半分ぶんずれて、最初に戻るところで写真が跳ぶ
              <li
                key={`${photo.src}-${index}`}
                className={`shrink-0 pr-3 sm:pr-4 ${isCopy ? "support-gallery__copy" : ""}`}
                aria-hidden={isCopy || undefined}
              >
                <div className="relative aspect-[16/9] w-[16rem] overflow-hidden rounded-card bg-nicchyo-ink/[0.06] sm:w-[26rem] lg:w-[34rem]">
                  <Image
                    src={photo.src}
                    alt={isCopy ? "" : photo.alt}
                    fill
                    sizes="(min-width: 1024px) 544px, (min-width: 640px) 416px, 256px"
                    className="object-cover"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mx-auto mt-4 flex max-w-[64rem] justify-end px-6 sm:px-8">
        <button
          type="button"
          // 文言そのものが切り替わるので、aria-pressed は付けない（付けると二重に伝わる）
          onClick={() => setIsPaused((paused) => !paused)}
          className={`support-gallery__toggle ${buttonClass({ variant: "quiet", size: "sm" })}`}
        >
          {isPaused ? (
            <Play className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Pause className="h-3.5 w-3.5" aria-hidden />
          )}
          {isPaused ? "写真を流す" : "写真を止める"}
        </button>
      </div>
    </div>
  );
}
