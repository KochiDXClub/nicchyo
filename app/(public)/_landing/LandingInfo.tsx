import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageContainer } from "@/components/ui";
import { siteTextWithEmphasis } from "@/lib/siteCopy";
import { MARKET_FACTS } from "./content";
import SectionHeading from "./SectionHeading";

/** 開催のご案内。日曜市の数字（シートの mapIntro.lead）と、いつ・どこ・お休みを罫で区切って並べる */
export default function LandingInfo() {
  return (
    <section aria-labelledby="landing-info" className="mt-20">
      <PageContainer width="wide">
        <SectionHeading id="landing-info" label="INFO">
          開催のご案内
        </SectionHeading>
        <p className="mt-3 text-sm leading-relaxed text-nicchyo-ink/70">
          {siteTextWithEmphasis("mapIntro.lead", "font-bold text-nicchyo-ink")}
        </p>
        <dl className="mt-4 divide-y divide-line-warm border-y border-line-warm">
          {MARKET_FACTS.map((fact) => (
            <div key={fact.term} className="flex gap-4 py-3.5">
              <dt className="w-16 shrink-0 border-l-[3px] border-nicchyo-primary pl-2 text-sm font-bold text-nicchyo-ink">
                {fact.term}
              </dt>
              <dd className="text-sm text-nicchyo-ink/70">{fact.detail}</dd>
            </div>
          ))}
        </dl>
        <Link
          href="/calendar"
          className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:text-amber-600"
        >
          開催カレンダー
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </PageContainer>
    </section>
  );
}
