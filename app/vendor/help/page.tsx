import Link from "next/link";
import { PageContainer, PageShell, PageTitle } from "@/components/ui";
import { Megaphone, Store, BarChart2, Sparkles, User, ChevronRight } from "lucide-react";
import { VENDOR_HELP_GUIDE } from "@/lib/vendor/helpGuide";

export const dynamic = "force-dynamic";

/** ガイドの各項目に付ける絵と色。文章は lib/vendor/helpGuide.ts（にちよさんへの相談と共通） */
const SECTION_STYLE: Record<string, { icon: typeof Megaphone; color: string }> = {
  "/vendor/post/new": { icon: Megaphone, color: "bg-amber-100 text-amber-600" },
  "/vendor/store": { icon: Store, color: "bg-emerald-100 text-emerald-600" },
  "/vendor/analytics": { icon: BarChart2, color: "bg-violet-100 text-violet-600" },
  "/vendor/ai-knowledge": { icon: Sparkles, color: "bg-rose-100 text-rose-600" },
  "/vendor/account": { icon: User, color: "bg-slate-100 text-slate-600" },
};

const GUIDE_SECTIONS = VENDOR_HELP_GUIDE.map((section) => ({
  ...section,
  ...(SECTION_STYLE[section.href] ?? { icon: Sparkles, color: "bg-amber-100 text-amber-600" }),
}));

export default function VendorHelpPage() {
  return (
    <PageShell bottomNav={false}>
      {/* ヘッダー */}
      <PageTitle title="使い方ガイド" />

      <PageContainer className="space-y-5">
        <div className="rounded-[28px] border border-amber-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600">Overview</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">まずはここを見れば大丈夫です</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                使う頻度の高い機能を上から順に並べています。文字は大きめ、カードは押しやすくしています。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 md:w-[240px]">
              <div className="rounded-2xl bg-amber-50 px-3 py-3">
                <p className="text-[11px] font-semibold text-amber-700">おすすめ</p>
                <p className="mt-1 text-sm font-bold text-amber-900">近況を出す</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-3 py-3">
                <p className="text-[11px] font-semibold text-emerald-700">基本設定</p>
                <p className="mt-1 text-sm font-bold text-emerald-900">店舗情報の更新</p>
              </div>
              <div className="rounded-2xl bg-violet-50 px-3 py-3">
                <p className="text-[11px] font-semibold text-violet-700">見やすい</p>
                <p className="mt-1 text-sm font-bold text-violet-900">お店の分析</p>
              </div>
              <div className="rounded-2xl bg-rose-50 px-3 py-3">
                <p className="text-[11px] font-semibold text-rose-700">AI活用</p>
                <p className="mt-1 text-sm font-bold text-rose-900">にちよさんの覚えごと</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {/* 各セクション */}
          {GUIDE_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.href} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <Link href={section.href} className="flex items-start gap-4 px-4 py-4 transition hover:bg-slate-50 md:px-5">
                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${section.color}`}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-slate-800 md:text-lg">{section.title}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">開く</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500 md:text-base">{section.description}</p>
                </div>
                <ChevronRight size={18} className="mt-1 flex-shrink-0 text-slate-300" />
              </Link>

              <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 md:px-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">使うときのポイント</p>
                <ul className="grid gap-2 md:grid-cols-2">
                  {section.tips.map((tip) => (
                    <li key={tip} className="flex items-start gap-2 rounded-2xl bg-white px-3 py-3 text-sm leading-relaxed text-slate-600 shadow-sm">
                      <span className="mt-0.5 flex-shrink-0 text-amber-400">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
        </div>
      </PageContainer>

    </PageShell>
  );
}
