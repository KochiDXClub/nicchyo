"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { fetchVendorAnalytics, fetchSearchSourceRatio, fetchVendorHeartSummary } from "../_services/analyticsService";
import type { VendorAnalytics, SearchSourceRatio, HeartSummary } from "../_types";
import {
  ArrowLeft, Eye, MousePointerClick, Search,
  BarChart2, Clock, ShoppingBag, TrendingUp,
  ChevronRight, ArrowUp, ArrowDown, Loader2, MapPin, Navigation, MessageCircle, Heart,
} from "lucide-react";

function DeltaBadge({ current, prev }: { current: number; prev: number }) {
  const diff = current - prev;
  const pct = prev > 0 ? Math.round((diff / prev) * 100) : 0;
  if (diff === 0) return null;
  const up = diff > 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${up ? "text-emerald-600" : "text-rose-500"}`}>
      {up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{Math.abs(pct)}%
    </span>
  );
}

const SUB_PAGES = [
  { href: "/vendor/analytics/time",     icon: Clock,          label: "時間帯分析",           desc: "来訪ピーク時間を確認",            color: "bg-sky-50 text-sky-600 border-sky-100" },
  { href: "/vendor/analytics/products", icon: ShoppingBag,    label: "商品分析",             desc: "自店の人気商品ランキング",          color: "bg-amber-50 text-amber-600 border-amber-100" },
  { href: "/vendor/analytics/ai",       icon: MessageCircle,  label: "AIばあちゃん分析",     desc: "相談トピック・キーワード・紹介回数", color: "bg-rose-50 text-rose-500 border-rose-100" },
  { href: "/vendor/analytics/input",    icon: TrendingUp,     label: "販売数量を入力",       desc: "今日の売上データを記録",            color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
];

const EMPTY_ANALYTICS: VendorAnalytics = {
  thisWeek: { views: 0, clicks: 0, searchImpressions: 0 },
  lastWeek: { views: 0, clicks: 0, searchImpressions: 0 },
  rank: 1, totalVendors: 1,
};

export default function VendorAnalyticsPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<VendorAnalytics>(EMPTY_ANALYTICS);
  const [sourceRatio, setSourceRatio] = useState<SearchSourceRatio>({ preVisit: 0, onSite: 0, other: 0 });
  const [hearts, setHearts] = useState<HeartSummary>({ total: 0, thisWeek: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetchVendorAnalytics(user.id),
      fetchSearchSourceRatio(user.id),
      fetchVendorHeartSummary(),
    ])
      .then(([a, s, h]) => { setAnalytics(a); setSourceRatio(s); setHearts(h); })
      .finally(() => setIsLoading(false));
  }, [user]);

  const { thisWeek, lastWeek, rank, totalVendors } = analytics;

  const metrics = [
    { label: "閲覧数",   icon: Eye,              value: thisWeek.views,             prev: lastWeek.views,             color: "text-amber-600", bg: "bg-amber-50" },
    { label: "クリック数",icon: MousePointerClick, value: thisWeek.clicks,            prev: lastWeek.clicks,            color: "text-sky-600",   bg: "bg-sky-50" },
    { label: "検索表示数",icon: Search,            value: thisWeek.searchImpressions, prev: lastWeek.searchImpressions, color: "text-violet-600",bg: "bg-violet-50" },
  ];

  return (
    <div className="min-h-screen bg-[#FFFAF0] pb-24">
      <div className="border-b border-amber-100 bg-white/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href="/my-shop" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">お店の分析</h1>
          </div>
          <div className="ml-auto flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5">
            <BarChart2 size={13} className="text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">{user?.name ?? "出店者"}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-5">

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-amber-500" />
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-amber-100 bg-white p-4 shadow-sm md:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600">Analytics</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">お店の動き</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                まずは「見られた数」「押された数」「どこで見られたか」の3つだけを確認すると流れがつかみやすくなります。
              </p>
            </div>

            {/* 今週の指標 */}
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-slate-700">今週の閲覧状況</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {metrics.map((m) => {
                  const Icon = m.icon;
                  return (
                    <div key={m.label} className="rounded-2xl bg-slate-50 p-4 text-center">
                      <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl ${m.bg}`}>
                        <Icon size={18} className={m.color} />
                      </div>
                      <p className="text-3xl font-black tracking-tight text-slate-900">{m.value.toLocaleString()}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">{m.label}</p>
                      <div className="mt-1 flex justify-center">
                        <DeltaBadge current={m.value} prev={m.prev} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-center text-xs text-slate-400">↑ 先週比</p>
              {thisWeek.views === 0 && (
                <p className="mt-2 text-center text-xs text-slate-300">マップで店舗が閲覧されると反映されます</p>
              )}
            </div>

            {/* もらったハート（投稿へのリアクション） */}
            <div className="rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-4 shadow-sm md:p-5">
              <div className="mb-1 flex items-center gap-1.5">
                <Heart size={14} className="fill-current text-rose-400" />
                <p className="text-sm font-semibold text-slate-700">もらったハート</p>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-black tracking-tight text-rose-400">
                  {hearts.total.toLocaleString()}
                </span>
                <span className="mb-1 text-base text-slate-500">個</span>
                {hearts.thisWeek > 0 && (
                  <span className="mb-1 ml-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-600">
                    今週 +{hearts.thisWeek.toLocaleString()}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                近況（投稿）にお客さんが付けたハートの合計です
              </p>
            </div>

            {/* 注目度ランキング */}
            <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm md:p-5">
              <p className="mb-1 text-sm font-semibold text-slate-700">市場内注目度ランキング</p>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-black tracking-tight text-amber-500">{rank}</span>
                <span className="mb-1 text-base text-slate-500">位 / {totalVendors}店中</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-amber-100">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${Math.round(((totalVendors - rank + 1) / totalVendors) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">閲覧数をもとに算出</p>
            </div>

            {/* 来訪前 / 現地の検索割合 */}
            {(() => {
              const total = sourceRatio.preVisit + sourceRatio.onSite + sourceRatio.other;
              const preVisitPct  = total > 0 ? Math.round((sourceRatio.preVisit / total) * 100) : 0;
              const onSitePct    = total > 0 ? Math.round((sourceRatio.onSite   / total) * 100) : 0;
              return (
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                  <p className="mb-3 text-sm font-semibold text-slate-700">来訪前 / 現地の検索割合（過去7日）</p>
                  {total === 0 ? (
                    <p className="py-5 text-center text-sm text-slate-400">データがまだありません</p>
                  ) : (
                    <>
                      <div className="mb-3 flex h-3.5 overflow-hidden rounded-full">
                        <div className="bg-violet-400 transition-all" style={{ width: `${preVisitPct}%` }} />
                        <div className="bg-sky-400 transition-all"    style={{ width: `${onSitePct}%` }} />
                        <div className="flex-1 bg-slate-200" />
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="flex items-center gap-1.5 rounded-2xl bg-violet-50 px-3 py-2">
                          <Navigation size={12} className="text-violet-500" />
                          <span className="text-sm text-slate-600">来訪前</span>
                          <span className="text-base font-bold text-slate-800">{preVisitPct}%</span>
                          <span className="text-xs text-slate-400">({sourceRatio.preVisit})</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-2xl bg-sky-50 px-3 py-2">
                          <MapPin size={12} className="text-sky-500" />
                          <span className="text-sm text-slate-600">現地</span>
                          <span className="text-base font-bold text-slate-800">{onSitePct}%</span>
                          <span className="text-xs text-slate-400">({sourceRatio.onSite})</span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">来訪前：マップ外の検索 / 現地：マップから直接</p>
                    </>
                  )}
                </div>
              );
            })()}

            {/* サブページ */}
            <div className="space-y-2.5">
              {SUB_PAGES.map((page) => {
                const Icon = page.icon;
                return (
                  <Link key={page.href} href={page.href}
                    className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:shadow-md"
                  >
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border ${page.color}`}>
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-slate-800">{page.label}</p>
                      <p className="text-sm text-slate-500">{page.desc}</p>
                    </div>
                    <ChevronRight size={16} className="flex-shrink-0 text-slate-300" />
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
