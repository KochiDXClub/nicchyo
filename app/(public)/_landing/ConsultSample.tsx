import Link from "next/link";
import { Mic, Send } from "lucide-react";
import { siteText } from "@/lib/siteCopy";
import GrandmaFigure from "./GrandmaFigure";

/**
 * 相談画面（/consult）の「答えが出たところ」の見本。本番と同じ部品の形で見せ、押すと相談画面をひらく。
 * 見本の受け答えはマップの案内（/map?panel=intro）と同じシートの文言を読む（docs/SITE_COPY.md）。
 *
 * 本番の見た目を変えたら、ここも合わせる:
 * - 答えのカード・候補ボタン・入力バー … app/(public)/consult/components/ConsultStage.tsx
 * 見本の中は押せる部品にしない（全体を1つのリンクにする）
 */
export default function ConsultSample() {
  return (
    <Link
      href="/consult"
      aria-label="にちよさんの相談画面をひらく"
      className="block rounded-sheet bg-nicchyo-base p-4 shadow-float ring-1 ring-line transition-transform duration-200 ease-out-soft hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {/* 中身は見本の絵。読み上げはリンクの名前で足りるので、中は読ませない */}
      <div aria-hidden className="flex flex-col gap-3">
        <GrandmaFigure className="mx-auto h-24 w-24" />

        {/* 今の答え（ConsultStage の答えのカード） */}
        <div className="rounded-card border border-amber-100 bg-white/90 p-4 shadow-sm">
          <p className="text-xs text-nicchyo-ink/70">{siteText("mapIntro.consultDemo.1.q")}</p>
          <p className="mt-1 text-[11px] font-bold text-amber-700">にちよさん</p>
          <p className="mt-2 text-[15px] leading-7 text-nicchyo-ink">{siteText("mapIntro.consultDemo.1.a")}</p>
        </div>

        {/* 候補ボタン */}
        <p className="rounded-btn border border-amber-200 bg-white px-4 py-3 text-sm font-bold text-amber-900 shadow-sm">
          {siteText("mapIntro.consultDemo.2.q")}
        </p>

        {/* 入力バー（文字入力＋送信、右に音声） */}
        <div className="flex items-center gap-2">
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
  );
}
