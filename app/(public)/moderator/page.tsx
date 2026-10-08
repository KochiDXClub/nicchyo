"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import { StatCard, ErrorBoundary, AdminLayout } from "@/components/admin";
import { createClient } from "@/utils/supabase/client";

type ReportStat = {
  total: number;
  open: number;
  inReview: number;
  resolved: number;
  todayCount: number;
};

type RecentReport = {
  id: string;
  target_type: string;
  target_name: string | null;
  reason: string;
  status: string;
  created_at: string;
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  vendor: "出店者",
  content: "近況投稿",
  kotodute: "ことづて",
};

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  open: { label: "未対応", color: "text-red-600", icon: "🚨" },
  in_review: { label: "確認中", color: "text-orange-600", icon: "👀" },
  resolved: { label: "対応済み", color: "text-green-600", icon: "✅" },
  dismissed: { label: "対応不要", color: "text-gray-500", icon: "🗂️" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

// アクティビティアイテム（メモ化）
const ActivityItem = React.memo(function ActivityItem({
  item,
}: {
  item: RecentReport;
}) {
  const statusInfo = STATUS_LABELS[item.status] ?? STATUS_LABELS.open;
  const targetLabel = TARGET_TYPE_LABELS[item.target_type] ?? item.target_type;
  const targetName = item.target_name ? `（${item.target_name}）` : "";

  return (
    <div className="flex items-start space-x-3 border-b border-gray-100 pb-3 last:border-0">
      <span className="text-2xl" aria-hidden="true">{statusInfo.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${statusInfo.color}`}>
          <span className="font-normal text-gray-700">
            {targetLabel}
            {targetName}への通報: {item.reason}
          </span>
          {` — ${statusInfo.label}`}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">{timeAgo(item.created_at)}</p>
      </div>
    </div>
  );
});

function ModeratorDashboardContent() {
  const { user, permissions, isLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<ReportStat | null>(null);
  const [recent, setRecent] = useState<RecentReport[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.canModerateContent) {
      router.push("/");
    }
  }, [isLoading, permissions.canModerateContent, router]);

  const loadStats = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const supabase = createClient();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [totalRes, openRes, inReviewRes, resolvedRes, todayRes, recentRes] =
        await Promise.all([
          supabase.from("reports").select("id", { count: "exact", head: true }),
          supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
          supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "in_review"),
          supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "resolved"),
          supabase.from("reports").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
          supabase
            .from("reports")
            .select("id, target_type, target_name, reason, status, created_at")
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

      setStats({
        total: totalRes.count ?? 0,
        open: openRes.count ?? 0,
        inReview: inReviewRes.count ?? 0,
        resolved: resolvedRes.count ?? 0,
        todayCount: todayRes.count ?? 0,
      });

      const rows = Array.isArray(recentRes.data) ? recentRes.data : [];
      setRecent(
        rows.map((row) => ({
          id: row.id,
          target_type: row.target_type ?? "",
          target_name: row.target_name ?? null,
          reason: row.reason ?? "",
          status: row.status ?? "open",
          created_at: row.created_at,
        }))
      );
    } catch {
      setDataError("データの取得に失敗しました");
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && permissions.canModerateContent) {
      loadStats();
    }
  }, [isLoading, permissions.canModerateContent, loadStats]);

  if (isLoading || !permissions.canModerateContent) {
    return null;
  }

  const statCards = stats
    ? [
        { title: "総通報数", value: String(stats.total), icon: "📋", bgColor: "bg-purple-50", textColor: "text-purple-600" },
        { title: "未対応", value: String(stats.open), icon: "🚨", bgColor: "bg-red-50", textColor: "text-red-600" },
        { title: "確認中", value: String(stats.inReview), icon: "👀", bgColor: "bg-orange-50", textColor: "text-orange-600" },
        { title: "今日の通報", value: String(stats.todayCount), icon: "📝", bgColor: "bg-blue-50", textColor: "text-blue-600" },
      ]
    : null;

  return (
    <AdminLayout>
      {/* ヘッダー */}
      <div className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:py-6">
          <h1 className="text-2xl font-bold text-purple-900 sm:text-3xl">モデレーターダッシュボード</h1>
          <p className="mt-1 text-sm text-gray-600">ようこそ、{user?.name}さん</p>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="mx-auto max-w-7xl px-4 py-4 sm:py-8 pb-20">
        {/* エラー */}
        {dataError && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 flex items-center justify-between">
            <p className="text-sm text-red-700">{dataError}</p>
            <button
              type="button"
              onClick={loadStats}
              className="ml-4 rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
            >
              再試行
            </button>
          </div>
        )}

        {/* 統計カード */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6 sm:mb-8">
          {dataLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg bg-white p-4 shadow animate-pulse">
                  <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
                  <div className="h-8 w-12 bg-gray-200 rounded" />
                </div>
              ))
            : statCards?.map((stat) => (
                <StatCard
                  key={stat.title}
                  title={stat.title}
                  value={stat.value}
                  icon={stat.icon}
                  bgColor={stat.bgColor}
                  textColor={stat.textColor}
                />
              ))}
        </div>

        {/* サブ統計（対応済み数） */}
        {stats && (
          <div className="mb-6 sm:mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-green-50 p-3 shadow text-center">
              <p className="text-xs text-green-600">対応済み</p>
              <p className="text-xl font-bold text-green-600">{stats.resolved}</p>
            </div>
          </div>
        )}

        {/* 最近の通報 */}
        <div className="rounded-lg bg-white p-4 sm:p-6 shadow" role="region" aria-labelledby="recent-reports">
          <h2 id="recent-reports" className="text-lg font-bold text-gray-900 mb-4 sm:text-xl">
            最近の通報
          </h2>
          {dataLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-8 w-8 bg-gray-200 rounded" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded mb-2 w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <p className="text-sm text-gray-500">通報はまだありません</p>
          ) : (
            <div className="space-y-3">
              {recent.map((item) => (
                <ActivityItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default function ModeratorDashboard() {
  return (
    <ErrorBoundary>
      <ModeratorDashboardContent />
    </ErrorBoundary>
  );
}
