import Link from "next/link";
import { ArrowRight, Mic, Send } from "lucide-react";
import { PageContainer, buttonClass } from "@/components/ui";
import { siteText } from "@/lib/siteCopy";
import GrandmaPerch from "./GrandmaPerch";
import SectionHeading from "./SectionHeading";

/** できることの箇条書き。相談画面（app/(public)/consult/）に実際にある機能だけを書く */
const CONSULT_POINTS = [
  "候補をタップするか、文字や声で話しかけるだけ",
  "その日に出ているお店の情報をもとに、土佐ことばで答えます",
  "紹介されたお店は、そのまま写真と地図で確かめられます",
];

/**
 * にちよさんの紹介。相談画面（/consult）の「答えが出たところ」を、本番と同じ部品の形で見せる。
 * 見本の受け答えはマップの案内（/map?panel=intro）と同じシートの文言を読む（docs/SITE_COPY.md）。
 *
 * 本番の見た目を変えたら、ここも合わせる:
 * - 答えのカード・候補ボタン・入力バー … app/(public)/consult/components/ConsultStage.tsx
 * - にちよさんの絵 … GrandmaAvatar.tsx（ここでは着地点だけを置き、絵は LandingGrandma が運んでくる）
 * 見本の中は押せる部品にしない（全体を1つのリンクにして、相談画面をひらく）
 */
export default function LandingNichiyosan() {
  return (
    <section aria-labelledby="landing-nichiyosan" data-grandma-section="consult" className="mt-24">
      <PageContainer width="wide">
        <SectionHeading id="landing-nichiyosan" label="CONSULT">
          にちよさんに相談
        </SectionHeading>
      </PageContainer>
      <PageContainer width="wide" className="mt-10 grid gap-10 md:grid-cols-[1fr_22rem] md:items-center md:gap-12">
        <div>
          <p className="font-display text-xl leading-relaxed text-nicchyo-ink sm:text-2xl">
            わからんことは、
            <br />
            にちよさんに聞きや。
          </p>
          <p className="mt-4 text-base leading-relaxed text-nicchyo-ink/70">
            日曜市のことなら、なんでも知っちゅう大ベテラン。おすすめの食べ歩きから、はじめての回り方まで、聞いたら答えてくれます。
          </p>
          <ul className="mt-5 space-y-2">
            {CONSULT_POINTS.map((point) => (
              <li key={point} className="flex gap-2.5 text-sm leading-relaxed text-nicchyo-ink">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-chip bg-nicchyo-primary" />
                {point}
              </li>
            ))}
          </ul>
          <Link href="/consult" className={buttonClass({ variant: "secondary", size: "lg", className: "mt-6" })}>
            にちよさんに相談する
            <ArrowRight aria-hidden className="h-5 w-5" />
          </Link>
        </div>

        <figure className="mx-auto w-full max-w-[22rem]">
          <Link
            href="/consult"
            aria-label="にちよさんの相談画面をひらく"
            className="group block rounded-sheet bg-nicchyo-base p-4 shadow-float ring-1 ring-line transition-transform duration-200 ease-out-soft hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {/* 中身は見本の絵。読み上げはリンクの名前で足りるので、中は読ませない */}
            <div aria-hidden className="flex flex-col gap-3">
              {/* 見本の中のにちよさん。ここが着地点で、飛んできたにちよさんがここに収まる */}
              <GrandmaPerch section="consult" className="mx-auto h-28 w-28" />

              {/* 今の答え（ConsultStage の答えのカード） */}
              <div className="rounded-card border border-amber-100 bg-white/90 p-4 shadow-sm">
                <p className="text-xs text-nicchyo-ink/70">{siteText("mapIntro.consultDemo.1.q")}</p>
                <p className="mt-1 text-[11px] font-bold text-amber-700">にちよさん</p>
                <p className="mt-2 text-[15px] leading-7 text-nicchyo-ink">{siteText("mapIntro.consultDemo.1.a")}</p>
              </div>

              {/* 候補ボタン */}
              {(["mapIntro.consultDemo.2.q", "mapIntro.consultDemo.3.q"] as const).map((key) => (
                <p
                  key={key}
                  className="rounded-btn border border-amber-200 bg-white px-4 py-3 text-sm font-bold text-amber-900 shadow-sm"
                >
                  {siteText(key)}
                </p>
              ))}

              {/* 入力バー（文字入力＋送信、右に音声） */}
              <div className="mt-1 flex items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-chip border border-amber-200 bg-white/95 py-1 pl-4 pr-1 shadow-card">
                  <span className="min-w-0 flex-1 truncate text-sm text-nicchyo-ink/40">（例）今の旬の果物は？</span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-amber-500 text-white">
                    <Send className="h-4 w-4" />
                  </span>
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-chip border border-amber-200 bg-white/95 text-amber-800 shadow-card">
                  <Mic className="h-5 w-5" />
                </span>
              </div>
            </div>
          </Link>
          <figcaption className="mt-3 text-center text-xs leading-relaxed text-nicchyo-ink/70">
            {siteText("mapIntro.consultDemo.note")}
          </figcaption>
        </figure>
      </PageContainer>
    </section>
  );
}
