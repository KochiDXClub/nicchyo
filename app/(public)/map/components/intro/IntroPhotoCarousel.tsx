'use client';

/**
 * IntroPhotoCarousel
 *
 * 「はじめての方へ」の先頭に置く、日曜市の写真のスライド。
 * 3秒ごとに次の写真へ重ねて切り替え、最後まで行ったら最初に戻って回り続ける。
 * 動きを減らす設定の人には、ふわっと重ねずにぱっと切り替える。
 *
 * children は写真の上（左下）に重ねて出す。写真が変わっても読めるよう、
 * 写真全体を少し暗くし、文字には影を付ける。
 *
 * 写真を差し替えるときは INTRO_PHOTOS だけを直す。
 */

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

const INTRO_PHOTOS = [
  { src: '/images/home-hero.jpg', alt: '追手筋に屋台が並ぶ日曜市の通り' },
  { src: '/images/activities/2025-10-19-sunday-market-survey.webp', alt: '日曜市の屋台の前でにぎわう人たち' },
  { src: '/images/shops/kawazaiku.webp', alt: '日曜市の屋台に並ぶ革小物' },
] as const;

const INTERVAL_MS = 3000;

export default function IntroPhotoCarousel({ children }: { children?: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % INTRO_PHOTOS.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative aspect-[2/1] w-full overflow-hidden rounded-card bg-nicchyo-ink/5">
      {INTRO_PHOTOS.map((photo, i) => (
        <Image
          key={photo.src}
          src={photo.src}
          alt={photo.alt}
          fill
          priority={i === 0}
          sizes="(min-width: 768px) 620px, 100vw"
          aria-hidden={i !== index}
          className={cn(
            'object-cover',
            !reduceMotion && 'transition-opacity duration-700 ease-in-out',
            i === index ? 'opacity-100' : 'opacity-0'
          )}
        />
      ))}
      {children && (
        <div className="absolute inset-0 flex items-end bg-nicchyo-ink/25 p-4 md:p-6">{children}</div>
      )}
    </div>
  );
}
