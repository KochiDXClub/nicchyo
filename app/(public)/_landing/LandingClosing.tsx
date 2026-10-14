import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { PageContainer, Surface, buttonClass } from "@/components/ui";
import { siteText } from "@/lib/siteCopy";

/** チラシの裏表紙。にちよさんの見送りと、もう一度だけ地図への入口を置く */
export default function LandingClosing() {
  return (
    <section aria-labelledby="landing-closing" className="mt-20">
      <PageContainer width="wide">
        <Surface padding="lg" className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <Image
            src="/images/obaasan_transparent.webp"
            alt=""
            width={768}
            height={768}
            sizes="8rem"
            className="w-28 shrink-0 sm:w-32"
          />
          <div className="flex-1">
            <h2 id="landing-closing" className="font-display text-2xl leading-snug text-nicchyo-ink">
              さあ、日曜市へ。
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-nicchyo-ink/70">「{siteText("mapIntro.end.comment")}」</p>
          </div>
          <Link href="/map" className={buttonClass({ size: "lg", className: "shrink-0" })}>
            <MapPin aria-hidden className="h-5 w-5" />
            マップをひらく
          </Link>
        </Surface>
        <p className="mt-6 text-center text-xs text-nicchyo-ink/55">
          nicchyo は、日曜市をはじめての人にも歩きやすくするためのプロジェクトです。
          <Link href="/about" className="ml-1 font-bold text-amber-700 underline-offset-2 hover:underline">
            nicchyo について
          </Link>
        </p>
      </PageContainer>
    </section>
  );
}
