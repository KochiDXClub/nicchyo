import { Badge, PageContainer } from "@/components/ui";
import ConsultSample from "./ConsultSample";
import { SAMPLE_SHOP } from "./content";
import LandingShopReveal from "./LandingShopReveal";
import SectionHeading from "./SectionHeading";

/**
 * できること。説明を書く代わりに、実際の画面の形（お店のバナー・相談）を並べ、一言だけ添える。
 * お店のバナーは見本の店（SAMPLE_SHOP）なので「見本」の札を付ける
 */
export default function LandingHowTo() {
  return (
    <section aria-labelledby="landing-howto" className="mt-20">
      <PageContainer width="wide">
        <SectionHeading id="landing-howto" label="HOW TO">
          見て、聞いて、歩く
        </SectionHeading>
        <div className="mt-6 grid gap-12 md:grid-cols-2 md:gap-10">
          <figure className="mx-auto w-full max-w-[24rem]">
            <div className="relative">
              <Badge variant="solid" className="absolute -top-3 left-4 z-[1]">
                見本
              </Badge>
              <LandingShopReveal shop={SAMPLE_SHOP} />
            </div>
            <figcaption className="mt-2 text-center text-[15px] font-bold text-nicchyo-ink">
              お店を押すと、くわしくひらく
            </figcaption>
          </figure>
          <figure className="mx-auto w-full max-w-[22rem]">
            <ConsultSample />
            <figcaption className="mt-5 text-center text-[15px] font-bold text-nicchyo-ink">
              わからんことは、にちよさんに
            </figcaption>
          </figure>
        </div>
      </PageContainer>
    </section>
  );
}
