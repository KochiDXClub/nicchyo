import Link from "next/link";
import { ArrowRight, MapPin, MessageCircle, Search, type LucideIcon } from "lucide-react";
import { PageContainer, Surface } from "@/components/ui";
import { LANDING_FEATURES, type LandingFeature } from "./content";
import SectionHeading from "./SectionHeading";

const FEATURE_ICONS: Record<LandingFeature["id"], LucideIcon> = {
  map: MapPin,
  consult: MessageCircle,
  search: Search,
};

/** できること（マップ・相談・さがす）。スマートフォンでは縦に積み、広い画面では3列に並べる */
export default function LandingFeatures() {
  return (
    <section aria-labelledby="landing-features" className="mt-20">
      <PageContainer width="wide">
        <SectionHeading id="landing-features" eyebrow="nicchyo でできること">
          見る、聞く、さがす。
        </SectionHeading>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {LANDING_FEATURES.map((feature) => {
            const Icon = FEATURE_ICONS[feature.id];
            return (
              <Surface as="li" key={feature.id} padding="none">
                <Link href={feature.href} className="group flex h-full flex-col p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-chip bg-amber-100 text-amber-700">
                      <Icon aria-hidden className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-bold text-amber-700">{feature.label}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-bold leading-snug text-nicchyo-ink">{feature.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-nicchyo-ink/70">{feature.body}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-amber-700 group-hover:text-amber-600">
                    {feature.cta}
                    <ArrowRight
                      aria-hidden
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    />
                  </span>
                </Link>
              </Surface>
            );
          })}
        </ul>
      </PageContainer>
    </section>
  );
}
