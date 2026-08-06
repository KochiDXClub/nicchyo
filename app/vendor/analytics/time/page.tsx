"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { fetchHourlyData } from "../../_services/analyticsService";
import type { HourlyData } from "../../_types";
import { ArrowLeft, Clock, TrendingUp, Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const PEAK_COLOR = "#f59e0b";
const BASE_COLOR = "#fde68a";

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-amber-100 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      <p className="text-base font-bold text-amber-600">{payload[0].value} 回</p>
    </div>
  );
}

export default function TimeAnalyticsPage() {
  const { user } = useAuth();
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [isLoading, setIsLoading]   = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchHourlyData(user.id)
      .then(setHourlyData)
      .finally(() => setIsLoading(false));
  }, [user]);

  const maxViews = hourlyData.length > 0 ? Math.max(...hourlyData.map((d) => d.views)) : 0;
  const peakHour = hourlyData.find((d) => d.views === maxViews && maxViews > 0);
  const hasData  = maxViews > 0;

  return (
    <div className="min-h-screen bg-[#FFFAF0] pb-24">
      <div className="border-b border-amber-100 bg-white/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href="/vendor/analytics" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-600">Time Analytics</p>
            <h1 className="text-xl font-bold text-slate-900">時間帯分析</h1>
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
            <div className="rounded-3xl border border-amber-100 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600">Time Analytics</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">時間帯分析</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                いつ見られているかが分かると、投稿や案内のタイミングを合わせやすくなります。
              </p>
            </div>

            {/* インサイトカード */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50">
                  <TrendingUp size={15} className="text-amber-600" />
                </div>
                <p className="text-sm text-slate-500">ピーク時間</p>
                <p className="text-3xl font-bold text-amber-600">{hasData ? peakHour?.hour : "—"}</p>
                <p className="text-xs text-slate-400">{hasData ? `閲覧数 ${maxViews} 回` : "データなし"}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50">
                  <Clock size={15} className="text-sky-600" />
                </div>
                <p className="text-sm text-slate-500">今週の閲覧合計</p>
                <p className="text-3xl font-bold text-sky-600">
                  {hourlyData.reduce((s, d) => s + d.views, 0)}
                </p>
                <p className="text-xs text-slate-400">過去7日間</p>
              </div>
            </div>

            {/* グラフ */}
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-1 text-base font-semibold text-slate-700">時間帯別 閲覧数</p>
              <p className="mb-4 text-sm text-slate-400">過去7日間の合計</p>
              {!hasData ? (
                <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-slate-400">
                  <p className="text-sm">まだ閲覧データがありません</p>
                  <p className="text-xs text-slate-300">マップで店舗が閲覧されると表示されます</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={hourlyData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#fef3c7" }} />
                    <Bar dataKey="views" radius={[6, 6, 0, 0]} maxBarSize={36}>
                      {hourlyData.map((entry) => (
                        <Cell key={entry.hour} fill={entry.views === maxViews ? PEAK_COLOR : BASE_COLOR} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              {hasData && (
                <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />ピーク時間</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-200" />その他</span>
                </div>
              )}
            </div>

            {/* アドバイス */}
            {hasData && (
              <div className="rounded-3xl border border-sky-100 bg-sky-50 px-4 py-3">
                <p className="text-sm font-semibold text-sky-700">アドバイス</p>
                <p className="mt-1 text-sm leading-relaxed text-sky-800">
                  {peakHour?.hour}頃が最も閲覧が多い時間帯です。この時間帯に合わせてSNS投稿や限定商品のアナウンスをすると効果的です。
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
