import Link from "next/link";
import { PageContainer, buttonClass } from "@/components/ui";

/**
 * 出店者の方へ。来訪者向けの話のあとに、出店者向けの入口を1つだけ置く。
 * 出店者ページ（/my-shop）は出店者としてログインしていないと開けないので、お問い合わせへつなぐ
 */
export default function LandingForShops() {
  return (
    <section aria-labelledby="landing-for-shops" className="mt-20">
      <PageContainer
        width="wide"
        className="flex flex-wrap items-center justify-between gap-4 border-y border-line-warm py-6"
      >
        <div>
          <p className="text-[0.7rem] font-bold tracking-[0.16em] text-amber-700">FOR SHOPS</p>
          <h2 id="landing-for-shops" className="mt-1.5 text-[17px] font-bold text-nicchyo-ink">
            お店の情報を、地図にのせませんか
          </h2>
        </div>
        <Link href="/contact" className={buttonClass({ variant: "secondary" })}>
          出店者の方はこちら
        </Link>
      </PageContainer>
    </section>
  );
}
