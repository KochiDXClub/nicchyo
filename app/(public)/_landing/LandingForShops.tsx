import Link from "next/link";
import { PageContainer, buttonClass } from "@/components/ui";

/**
 * 出店者の方へ。来訪者向けの話のあとに、出店者向けの入口を1つだけ置く。
 * 絵は、屋台の上に赤いピンが落ちて、地図にのる動き。
 * 出店者ページ（/my-shop）は出店者としてログインしていないと開けないので、お問い合わせへつなぐ
 */
export default function LandingForShops() {
  return (
    <section aria-labelledby="landing-for-shops" className="mt-20 md:mt-24">
      <PageContainer width="wide">
        <div className="flex flex-col items-center gap-4 rounded-sheet bg-white p-6 text-center shadow-card ring-1 ring-line-warm md:flex-row md:justify-center md:gap-10 md:text-left">
          <div aria-hidden className="relative h-32 w-[10.6rem] shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- 手描きの SVG */}
            <img src="/images/landing/art/shop-stall.svg" alt="" width={160} height={120} className="h-full w-full" />
            <span className="landing-pindrop absolute -top-3.5 left-1/2 -ml-5 block h-[52px] w-10">
              {/* eslint-disable-next-line @next/next/no-img-element -- 手描きの SVG */}
              <img src="/images/landing/art/pin.svg" alt="" width={40} height={52} className="block h-full w-full drop-shadow-md" />
              <i className="landing-ripple absolute -bottom-0.5 left-1/2 -ml-[17px] h-2.5 w-[34px] rounded-[50%] border-2 border-red-500" />
            </span>
          </div>
          <div>
            <h2 id="landing-for-shops" className="text-[19px] font-black leading-relaxed text-nicchyo-ink">
              お店の情報を、地図にのせませんか
            </h2>
            <Link href="/contact" className={buttonClass({ variant: "secondary", className: "mt-3" })}>
              出店者の方はこちら
            </Link>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
