import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageContainer } from "@/components/ui";
import { formatShopIdToCode } from "@/lib/shops/route";
import type { Shop } from "../map/data/shops";
import LandingShopReveal from "./LandingShopReveal";
import SectionHeading from "./SectionHeading";

/**
 * お店の紹介。実際に出店している1店を、地図で店をタップしたときと同じバナーで見せる。
 * 写真のある店が無いときは、このセクションごと出さない（作り物の店は見せない）
 */
export default function LandingShop({ shop }: { shop: Shop | null }) {
  if (!shop) return null;
  const code = formatShopIdToCode(shop.id);

  return (
    <section aria-labelledby="landing-shop" className="mt-24">
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
              ※ 実際に出店しているお店の情報です
            </p>
            <div className="mt-5 flex flex-col items-start gap-3">
              {code && (
                <Link
                  href={`/shops/${code}`}
                  className="inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:text-amber-600"
                >
                  {shop.name.trim()}のページを見る
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              )}
              <Link
                href="/search"
                className="inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:text-amber-600"
              >
                品物やジャンルでお店をさがす
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div>
            <LandingShopReveal shop={shop} />
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
