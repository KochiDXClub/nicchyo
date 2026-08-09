"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { fetchAiConsultAnalytics } from "../../_services/analyticsService";
import type { AiConsultAnalytics } from "../../_types";
import { ArrowLeft, MessageCircle, Hash, Star, MapPin, Navigation } from "lucide-react";
import { CenteredLoading } from "@/components/ui/loading-spinner";
import { EmptyMessage } from "@/components/ui/empty-message";

const TOPIC_COLORS: Record<string, string> = {
  人気商品: "bg-amber-400",
  味:       "bg-rose-400",
  行列:     "bg-orange-400",
  営業時間: "bg-sky-400",
  おすすめ: "bg-emerald-400",
  その他:   "bg-slate-300",
};

const EMPTY: AiConsultAnalytics = {
  topics: [], keywords: [], recommendationCount: 0,
  locationRatio: { preVisit: 0, onSite: 0 }, totalCount: 0,
};

export default function AiAnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AiConsultAnalytics>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchAiConsultAnalytics(user.id)
      .then(setData)
      .finally(() => setIsLoading(false));
  }, [user]);

  const total = data.locationRatio.preVisit + data.locationRatio.onSite;
  const preVisitPct = total > 0 ? Math.round((data.locationRatio.preVisit / total) * 100) : 0;
  const onSitePct   = total > 0 ? Math.round((data.locationRatio.onSite   / total) * 100) : 0;
  const maxTopic    = data.topics[0]?.count ?? 1;
  const maxKeyword  = data.keywords[0]?.count ?? 1;

  return (
    <div className="min-h-screen bg-[#FFFAF0] pb-24">
      <div className="border-b border-amber-100 bg-white/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href="/vendor/analytics" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-600">AI Analytics</p>
            <h1 className="text-xl font-bold text-slate-900">AIばあちゃん分析</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-5">
        {isLoading ? (
          <CenteredLoading />
        ) : (
          <>
            {/* サマリー */}
            <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Image src="/images/obaasan_transparent.png" alt="AIばあちゃん" width={56} height={56} className="opacity-80" />
                <div>
                  <p className="text-sm text-slate-500">過去7日間の相談総数</p>
                  <p className="text-4xl font-black text-amber-500">{data.totalCount}<span className="ml-1 text-base font-normal text-slate-500">件</span></p>
                </div>
                <div className="ml-auto text-center">
                  <p className="text-sm text-slate-500">紹介回数</p>
                  <p className="text-3xl font-black text-violet-500">{data.recommendationCount}<span className="ml-0.5 text-sm font-normal text-slate-500">回</span></p>
                </div>
              </div>
            </div>

            {/* 相談トピックランキング */}
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <MessageCircle size={14} />
                </div>
                <h2 className="text-base font-semibold text-slate-700">相談トピックランキング</h2>
              </div>
              {data.topics.length === 0 ? (
                <EmptyMessage message="相談データがまだありません" padding="py-6" />
              ) : (
                <div className="space-y-3">
                  {data.topics.map((item, i) => (
                    <div key={item.category} className="flex items-center gap-3">
                      <span className="w-4 flex-shrink-0 text-center text-xs font-bold text-slate-400">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">{item.category}について</span>
                          <span className="text-sm font-bold text-slate-800">{item.count}件</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all ${TOPIC_COLORS[item.category] ?? "bg-slate-400"}`}
                            style={{ width: `${Math.round((item.count / maxTopic) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 関連キーワード */}
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                  <Hash size={14} />
                </div>
                <h2 className="text-base font-semibold text-slate-700">関連キーワード</h2>
              </div>
              {data.keywords.length === 0 ? (
                <EmptyMessage message="キーワードデータがまだありません" padding="py-6" />
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {data.keywords.map((kw) => (
                      <span
                        key={kw.keyword}
                        className="flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-sm text-violet-800"
                        style={{ fontSize: `${Math.max(11, Math.min(16, 11 + (kw.count / maxKeyword) * 5))}px` }}
                      >
                        {kw.keyword}
                        <span className="text-[10px] text-violet-400">{kw.count}</span>
                      </span>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {data.keywords.slice(0, 5).map((kw) => (
                      <div key={kw.keyword} className="flex items-center gap-3">
                        <span className="w-16 flex-shrink-0 text-xs font-medium text-slate-600">{kw.keyword}</span>
                        <div className="flex-1 overflow-hidden rounded-full bg-slate-100" style={{ height: 6 }}>
                          <div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${Math.round((kw.count / maxKeyword) * 100)}%` }} />
                        </div>
                        <span className="w-8 text-right text-xs text-slate-500">{kw.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* AIばあちゃん紹介回数 */}
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-500">
                  <Star size={14} />
                </div>
                <h2 className="text-base font-semibold text-slate-700">AIばあちゃんがこの店を紹介した回数</h2>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-black text-rose-500">{data.recommendationCount}</span>
                <span className="mb-1 text-sm text-slate-500">回 / 過去7日間</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">ユーザーへの相談回答でこの店が紹介された回数</p>
            </div>

            {/* 来訪前 / 現地 割合 */}
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                  <MapPin size={14} />
                </div>
                <h2 className="text-base font-semibold text-slate-700">相談 来訪前 / 現地割合</h2>
              </div>
              {total === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">位置情報付きの相談データがまだありません</p>
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
                      <span className="text-xs text-slate-400">({data.locationRatio.preVisit}件)</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-2xl bg-sky-50 px-3 py-2">
                      <MapPin size={12} className="text-sky-500" />
                      <span className="text-sm text-slate-600">現地</span>
                      <span className="text-base font-bold text-slate-800">{onSitePct}%</span>
                      <span className="text-xs text-slate-400">({data.locationRatio.onSite}件)</span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">日曜市エリア内からの相談を「現地」と判定</p>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
