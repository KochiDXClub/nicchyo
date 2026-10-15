import Link from "next/link";
import { MapPin } from "lucide-react";
import { PageContainer, buttonClass } from "@/components/ui";

const DOTS = [
  { x: 8, y: 30, d: 0, s: 9 },
  { x: 22, y: 62, d: 1.3, s: 12 },
  { x: 46, y: 22, d: 0.7, s: 8 },
  { x: 78, y: 40, d: 1.9, s: 11 },
  { x: 93, y: 66, d: 0.4, s: 9 },
  { x: 66, y: 20, d: 2.4, s: 10 },
] as const;

/**
 * さあ、日曜市へ。最後の呼びかけ。黄色い帯に、にちよさんの「いってらっしゃい！」と、地図をひらくボタン。
 * 下の縁には、屋台が並ぶ。上の縁はテントのひさしの縞
 */
export default function LandingClosing() {
  return (
    <section aria-labelledby="landing-closing" className="mt-24 md:mt-32">
      <PageContainer width="wide">
        <div className="relative overflow-hidden rounded-sheet bg-nicchyo-accent pt-14 shadow-float md:pt-16">
          {/* ひさし */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-[26px] bg-[url('/images/landing/art/awning.svg')] bg-[length:56px_26px] bg-repeat-x" />
          <div aria-hidden className="landing-dots landing-dots-white pointer-events-none absolute inset-0">
            {DOTS.map((dot) => (
              <i key={`${dot.x}-${dot.y}`} style={{ left: `${dot.x}%`, top: `${dot.y}%`, ["--d" as string]: dot.d, ["--s" as string]: `${dot.s}px` }} />
            ))}
          </div>
          <div className="relative flex flex-col items-center gap-2 px-6 text-center md:flex-row md:justify-center md:gap-14 md:text-left">
            <div className="flex flex-col items-center">
              <p className="mb-2 rounded-card bg-white px-[18px] py-2 font-display text-[15px] text-nicchyo-ink shadow-chip">
                いってらっしゃい！
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element -- 既存の透過 WebP */}
              <img src="/images/obaasan_transparent.webp" alt="" width={128} height={128} className="landing-sticker landing-bounce-y h-32 w-32 object-contain" />
            </div>
            <div>
              <h2 id="landing-closing" className="font-display text-3xl leading-snug text-nicchyo-ink md:text-4xl">
                さあ、日曜市へ。
              </h2>
              <Link href="/map" className={buttonClass({ variant: "ink", size: "lg", className: "mt-4 gap-2.5" })}>
                <MapPin aria-hidden className="h-5 w-5" />
                マップをひらく
              </Link>
            </div>
          </div>
          {/* 屋台が並ぶ足もと */}
          {/* eslint-disable-next-line @next/next/no-img-element -- 手描きの SVG */}
          <img src="/images/landing/art/closing-stalls.svg" alt="" aria-hidden width={1000} height={128} className="relative mt-5 block h-28 w-full object-cover object-bottom md:h-32" />
        </div>
      </PageContainer>
    </section>
  );
}
