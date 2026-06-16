"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import { StatCard, MenuCard, ErrorBoundary, AdminLayout } from "@/components/admin";
import { createClient } from "@/utils/supabase/client";

type KotoduteStat = {
  total: number;
  published: number;
  hidden: number;
  deleted: number;
  reported: number;
  todayCount: number;
};

type RecentKotodute = {
  id: string;
  body: string;
  status: string;
  report_count: number;
  created_at: string;
  vendor_name: string | null;
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
  item: RecentKotodute;
}) {
  const isReported = item.report_count > 0;
  const isHidden = item.status === "hidden";
  const isDeleted = item.status === "deleted";

  const icon = isDeleted ? "🗑️" : isReported ? "🚨" : isHidden ? "👁️" : "💌";
  const color = isDeleted ? "text-gray-500" : isReported ? "text-red-600" : isHidden ? "text-orange-600" : "text-green-600";
  const label = isDeleted ? "削除済み" : isReported ? `${item.report_count}件報告` : isHidden ? "非表示" : "公開中";
  const shopLabel = item.vendor_name ? `（${item.vendor_name}へ）` : "（市場全体へ）";

  return (
    <div className="flex items-start space-x-3 border-b border-gray-100 pb-3 last:border-0">
      <span className="text-2xl" aria-hidden="true">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${color}`}>
          <span className="font-normal text-gray-700">{item.body.slice(0, 60)}{item.body.length > 60 ? "…" : ""}</span>
          {` — ${label}${shopLabel}`}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">{timeAgo(item.created_at)}</p>
      </div>
    </div>
  );
});

const menuItems = [
  { title: "ことづて管理", description: "投稿の承認・削除・編集", icon: "💌", href: "/moderator/kotodute", bgColor: "bg-purple-500" },
  { title: "報告された投稿", description: "ユーザー報告の確認", icon: "🚨", href: "/moderator/reports", bgColor: "bg-red-500" },
  { title: "スパムフィルター", description: "自動フィルター設定", icon: "🛡️", href: "/moderator/spam-filter", bgColor: "bg-orange-500" },
  { title: "統計・分析", description: "投稿の傾向分析", icon: "📊", href: "/moderator/analytics", bgColor: "bg-blue-500" },
  { title: "NGワード管理", description: "禁止ワード設定", icon: "🚫", href: "/moderator/ng-words", bgColor: "bg-gray-500" },
  { title: "設定", description: "モデレーション設定", icon: "⚙️", href: "/moderator/settings", bgColor: "bg-green-500" },
];

function ModeratorDashboardContent() {
  const { user, permissions, isLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<KotoduteStat | null>(null);
  const [recent, setRecent] = useState<RecentKotodute[]>([]);
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

      const [totalRes, publishedRes, hiddenRes, deletedRes, reportedRes, todayRes, recentRes] =
        await Promise.all([
          supabase.from("kotodutes").select("id", { count: "exact", head: true }),
          supabase.from("kotodutes").select("id", { count: "exact", head: true }).eq("status", "published"),
          supabase.from("kotodutes").select("id", { count: "exact", head: true }).eq("status", "hidden"),
          supabase.from("kotodutes").select("id", { count: "exact", head: true }).eq("status", "deleted"),
          supabase.from("kotodutes").select("id", { count: "exact", head: true }).gt("report_count", 0),
          supabase.from("kotodutes").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
          supabase
            .from("kotodutes")
            .select("id, body, status, report_count, created_at, vendors(shop_name)")
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

      setStats({
        total: totalRes.count ?? 0,
        published: publishedRes.count ?? 0,
        hidden: hiddenRes.count ?? 0,
        deleted: deletedRes.count ?? 0,
        reported: reportedRes.count ?? 0,
        todayCount: todayRes.count ?? 0,
      });

      const rows = Array.isArray(recentRes.data) ? recentRes.data : [];
      setRecent(
        rows.map((row) => ({
          id: row.id,
          body: row.body ?? "",
          status: row.status ?? "published",
          report_count: row.report_count ?? 0,
          created_at: row.created_at,
          vendor_name:
            row.vendors && typeof row.vendors === "object" && !Array.isArray(row.vendors)
              ? (row.vendors as { shop_name: string | null }).shop_name
              : Array.isArray(row.vendors) && row.vendors.length > 0
              ? (row.vendors[0] as { shop_name: string | null }).shop_name
              : null,
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
        { title: "総ことづて数", value: String(stats.total), icon: "💌", bgColor: "bg-purple-50", textColor: "text-purple-600" },
        { title: "公開中", value: String(stats.published), icon: "✅", bgColor: "bg-green-50", textColor: "text-green-600" },
        { title: "今日の投稿", value: String(stats.todayCount), icon: "📝", bgColor: "bg-blue-50", textColor: "text-blue-600" },
        { title: "報告あり", value: String(stats.reported), icon: "🚨", bgColor: "bg-red-50", textColor: "text-red-600" },
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

        {/* サブ統計（非表示・削除数） */}
        {stats && (
          <div className="mb-6 sm:mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-orange-50 p-3 shadow text-center">
              <p className="text-xs text-orange-600">非表示</p>
              <p className="text-xl font-bold text-orange-600">{stats.hidden}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 shadow text-center">
              <p className="text-xs text-gray-500">削除済み</p>
              <p className="text-xl font-bold text-gray-500">{stats.deleted}</p>
            </div>
          </div>
        )}

        {/* メニュー */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6 sm:mb-8">
          {menuItems.map((item) => (
            <MenuCard
              key={item.title}
              title={item.title}
              description={item.description}
              icon={item.icon}
              href={item.href}
              bgColor={item.bgColor}
            />
          ))}
        </div>

        {/* 最近のことづて */}
        <div className="rounded-lg bg-white p-4 sm:p-6 shadow" role="region" aria-labelledby="recent-kotodute">
          <h2 id="recent-kotodute" className="text-lg font-bold text-gray-900 mb-4 sm:text-xl">
            最近のことづて
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
            <p className="text-sm text-gray-500">ことづてはまだありません</p>
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
