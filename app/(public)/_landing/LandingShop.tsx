import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, PageContainer } from "@/components/ui";
import { SAMPLE_SHOP } from "./content";
import LandingShopReveal from "./LandingShopReveal";
import GrandmaPerch from "./GrandmaPerch";
import SectionHeading from "./SectionHeading";

/**
 * お店の紹介。地図で店をタップしたときと同じバナーで、日曜市で撮ったお店の写真を見せる。
 * 中の情報は見本（content.ts の SAMPLE_SHOP）なので、画面にもそう書く
 */
export default function LandingShop() {

  return (
    <section aria-labelledby="landing-shop" data-grandma-section="shop" className="mt-24">
      <PageContainer width="wide">
        <SectionHeading id="landing-shop" label="SHOPS">
          お店をのぞく
        </SectionHeading>

        <div className="mt-10 grid gap-10 md:grid-cols-[1fr_24rem] md:items-center md:gap-12">
          <div>
            <p className="font-display text-xl leading-relaxed text-nicchyo-ink sm:text-2xl">
              気になる店をタップすると、
              <br />
              お店のことがひらきます。
            </p>
            <p className="mt-4 text-base leading-loose text-nicchyo-ink/70">
              地図で屋台を押すと、写真と一緒に、出店している日・扱っている品物・お店のこだわりが下にひらきます。
              行く前に、どんなお店か分かります。
            </p>
            <p className="mt-3 text-xs leading-relaxed text-nicchyo-ink/55">
              ※ 画面は見本です。写真は日曜市で撮影したお店です
            </p>
            <div className="mt-5 flex flex-col items-start gap-3">
              <Link
                href="/search"
                className="inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:text-amber-600"
              >
                品物やジャンルでお店をさがす
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="relative">
            <GrandmaPerch section="shop" className="absolute -top-20 right-2 z-[1]" />
            <Badge variant="solid" className="absolute -top-3 left-4 z-[1]">
              見本
            </Badge>
            <LandingShopReveal shop={SAMPLE_SHOP} />
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
