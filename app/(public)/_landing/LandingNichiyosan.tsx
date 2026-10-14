import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageContainer, Surface } from "@/components/ui";
import { siteText, type SiteTextKey } from "@/lib/siteCopy";
import SectionHeading from "./SectionHeading";

/**
 * 相談の見本。マップの案内（/map?panel=intro）と同じ受け答えをシートから読むので、
 * 文言を直すときはシートの「マップ案内」タブを直す（docs/SITE_COPY.md）
 */
const SAMPLE_QUESTIONS: { q: SiteTextKey; a: SiteTextKey }[] = [
  { q: "mapIntro.consultDemo.1.q", a: "mapIntro.consultDemo.1.a" },
  { q: "mapIntro.consultDemo.2.q", a: "mapIntro.consultDemo.2.a" },
];

/** にちよさんの紹介と、相談の見本 */
export default function LandingNichiyosan() {
  return (
    <section aria-labelledby="landing-nichiyosan" className="mt-20">
      <PageContainer width="wide" className="grid gap-8 md:grid-cols-2 md:items-center md:gap-12">
        <div className="flex items-end gap-3">
          <Image
            src="/images/obaasan_transparent.webp"
            alt="にちよさん（麦わら帽子にスカーフのおばあちゃん）"
            width={768}
            height={768}
            sizes="10rem"
            className="w-32 shrink-0 sm:w-40"
          />
          <Surface padding="none" className="relative mb-16 px-4 py-3">
            <p className="font-display text-lg leading-snug text-nicchyo-ink">
              あんた、ちょっと
              <br />
              寄っていきや〜！
            </p>
            {/* 吹き出しのしっぽ。にちよさんの口元へ向ける（縁は左と下の border で描く。ring は clip-path で消えるため） */}
            <span
              aria-hidden
              className="absolute -left-1.5 bottom-4 h-3 w-3 rotate-45 border-b border-l border-line bg-white"
            />
          </Surface>
        </div>

        <div>
          <SectionHeading id="landing-nichiyosan" eyebrow="高知発のおせっかいAI">
            案内するがは、
            <br />
            にちよさん。
          </SectionHeading>
          <p className="mt-4 text-base leading-relaxed text-nicchyo-ink/70">
            地図の上でも、相談の画面でも。日曜市の歩き方を、土佐ことばでおせっかいに教えてくれます。
            はじめての日曜市でも、にちよさんがいれば心強いはず。
          </p>
        </div>

        <Surface padding="lg" className="md:col-span-2">
          <p className="text-sm font-bold text-nicchyo-ink/55">たとえば、こんなことが聞けます</p>
          <ul className="mt-4 grid gap-5 md:grid-cols-2">
            {SAMPLE_QUESTIONS.map(({ q, a }) => (
              <li key={q} className="space-y-2">
                <p className="ml-auto w-fit max-w-[85%] rounded-card rounded-br-md bg-amber-100 px-4 py-2 text-sm text-nicchyo-ink">
                  {siteText(q)}
                </p>
                <div className="flex items-start gap-2">
                  <Image
                    src="/images/obaasan_transparent.webp"
                    alt=""
                    width={768}
                    height={768}
                    sizes="2.5rem"
                    className="h-10 w-10 shrink-0 rounded-chip bg-nicchyo-base ring-1 ring-line"
                  />
                  <p className="max-w-[85%] rounded-card rounded-tl-md bg-nicchyo-base px-4 py-2 text-sm leading-relaxed text-nicchyo-ink ring-1 ring-line-warm">
                    {siteText(a)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-xs text-nicchyo-ink/70">{siteText("mapIntro.consultDemo.note")}</p>
            <Link
              href="/consult"
              className="inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:text-amber-600"
            >
              にちよさんに相談する
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
        </Surface>
      </PageContainer>
    </section>
  );
}
