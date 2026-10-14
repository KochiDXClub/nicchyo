import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, PageContainer, Surface } from "@/components/ui";
import { LANDING_FEATURES } from "./content";

/**
 * できること（マップ・相談・さがす）。チラシの中面のつもりで、告知ポスターを主役にする。
 * スマートフォンでは横に送るカード、広い画面では3列に並べる
 */
export default function LandingFeatures() {
  return (
    <section aria-labelledby="landing-features" className="mt-20">
      <PageContainer width="wide">
        <p className="text-sm font-bold tracking-wide text-amber-700">nicchyo でできること</p>
        <h2 id="landing-features" className="mt-2 font-display text-2xl leading-snug text-nicchyo-ink sm:text-3xl">
          見る、聞く、さがす。
        </h2>
        <p className="mt-1 text-xs text-nicchyo-ink/55 md:hidden">3つあります。横にスワイプしてください</p>
      </PageContainer>

      {/* 横送りはカードの影が切れないよう、上下に余白を取ってからはみ出しを隠す */}
      <PageContainer width="wide" className="px-0 sm:px-6">
        <ul className="mt-4 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 py-4 sm:scroll-px-0 sm:px-0 md:grid md:grid-cols-3 md:overflow-visible">
          {LANDING_FEATURES.map((feature) => (
            <Surface
              as="li"
              key={feature.id}
              padding="none"
              className="flex w-[72%] shrink-0 snap-start flex-col overflow-hidden sm:w-[46%] md:w-auto"
            >
              <Link href={feature.href} className="group flex h-full flex-col">
                <Image
                  src={feature.poster}
                  // 見出しと本文が同じことを言うので読み上げない（リンク名が長くなりすぎる）
                  alt=""
                  width={1024}
                  height={1536}
                  sizes="(min-width: 768px) 20rem, 72vw"
                  className="aspect-[3/4] w-full object-cover object-top"
                />
                <div className="flex flex-1 flex-col p-5">
                  <Badge variant="amber" className="w-fit">
                    {feature.label}
                  </Badge>
                  <h3 className="mt-2 text-lg font-bold leading-snug text-nicchyo-ink">{feature.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-nicchyo-ink/70">{feature.body}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-amber-700 group-hover:text-amber-600">
                    {feature.cta}
                    <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </span>
                </div>
              </Link>
            </Surface>
          ))}
        </ul>
      </PageContainer>
    </section>
  );
}
