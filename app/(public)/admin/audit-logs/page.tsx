"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader, EmptyState } from "@/components/admin";
import { showToast } from "@/lib/admin/toast";
import { exportToCSV, exportToJSON, formatDateForFilename } from "@/lib/admin/exportUtils";
import { Loader2, Search, Download } from "lucide-react";

type AuditLog = {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  user_created: "ユーザー作成",
  user_updated: "ユーザー更新",
  user_deleted: "ユーザー削除",
  user_role_changed: "権限変更",
  shop_created: "店舗作成",
  shop_updated: "店舗更新",
  shop_deleted: "店舗削除",
  shop_approved: "店舗承認",
  shop_suspended: "店舗停止",
  bulk_operation: "一括操作",
  data_export: "データエクスポート",
  login: "ログイン",
  logout: "ログアウト",
};

function getActionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function getActionColor(action: string) {
  if (action.includes("deleted") || action === "shop_suspended") {
    return "bg-red-600 text-white";
  }
  if (action.includes("approved") || action.includes("created")) {
    return "bg-green-700 text-white";
  }
  if (action.includes("updated") || action.includes("changed") || action === "bulk_operation") {
    return "bg-blue-600 text-white";
  }
  return "bg-gray-500 text-white";
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(new Date(iso));
}

export default function AuditLogsPage() {
  const { permissions, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "all">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "moderator">("all");

  useEffect(() => {
    if (authLoading) return;
    if (!permissions.isSuperAdmin) router.push("/");
  }, [authLoading, permissions.isSuperAdmin, router]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/audit-logs");
      if (!res.ok) throw new Error(res.statusText);
      const json = await res.json() as { logs: AuditLog[]; total: number };
      setLogs(json.logs ?? []);
      setTotalCount(json.total ?? 0);
    } catch {
      showToast.error("ログの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && permissions.isSuperAdmin) load();
  }, [authLoading, permissions.isSuperAdmin, load]);

  const filtered = useMemo(() => {
    const now = new Date();
    return logs.filter((log) => {
      // 日付フィルター
      if (dateFilter !== "all") {
        const d = new Date(log.created_at);
        if (dateFilter === "today") {
          if (d.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === "week") {
          const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
          if (d < weekAgo) return false;
        } else if (dateFilter === "month") {
          const monthAgo = new Date(now); monthAgo.setMonth(now.getMonth() - 1);
          if (d < monthAgo) return false;
        }
      }
      // ロールフィルター
      if (roleFilter !== "all") {
        const role = log.actor_role ?? "";
        if (roleFilter === "admin" && !["admin", "super_admin"].includes(role)) return false;
        if (roleFilter === "moderator" && role !== "moderator") return false;
      }
      // テキスト検索
      if (search) {
        const q = search.toLowerCase();
        return (
          (log.actor_email ?? "").toLowerCase().includes(q) ||
          (log.target_name ?? "").toLowerCase().includes(q) ||
          (log.details ?? "").toLowerCase().includes(q) ||
          getActionLabel(log.action).toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, dateFilter, roleFilter, search]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      todayCount: logs.filter((l) => new Date(l.created_at).toDateString() === today).length,
      adminCount: logs.filter((l) => ["admin", "super_admin"].includes(l.actor_role ?? "")).length,
      modCount: logs.filter((l) => l.actor_role === "moderator").length,
    };
  }, [logs]);

  const handleExportCSV = () => {
    const rows = filtered.map((l) => ({
      日時: formatDate(l.created_at),
      実行者: l.actor_email ?? "",
      ロール: l.actor_role ?? "",
      アクション: getActionLabel(l.action),
      対象種別: l.target_type ?? "",
      対象ID: l.target_id ?? "",
      対象名: l.target_name ?? "",
      詳細: l.details ?? "",
      IPアドレス: l.ip_address ?? "",
    }));
    exportToCSV(rows, `audit_logs_${formatDateForFilename()}.csv`);
  };

  const handleExportJSON = () => {
    exportToJSON(filtered, `audit_logs_${formatDateForFilename()}.json`);
  };

  if (authLoading || !permissions.isSuperAdmin) return null;

  return (
    <AdminLayout>
      <AdminPageHeader eyebrow="Audit" title="監査ログ" />

      <div className="mx-auto max-w-7xl px-4 py-8 pb-20">

        {/* 統計カード */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">総ログ数</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{totalCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">本日のアクション</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{stats.todayCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">管理者操作</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{stats.adminCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">モデレーター操作</p>
            <p className="mt-1 text-2xl font-bold text-purple-600">{stats.modCount}</p>
          </div>
        </div>

        {/* フィルター */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {/* 日付フィルター */}
          <div className="flex gap-2">
            {(["all", "today", "week", "month"] as const).map((f) => {
              const labels = { all: "すべて", today: "今日", week: "7日間", month: "30日間" };
              return (
                <button
                  type="button"
                  key={f}
                  onClick={() => setDateFilter(f)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    dateFilter === f ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {/* ロールフィルター */}
          <div className="flex gap-2">
            {(["all", "admin", "moderator"] as const).map((f) => {
              const labels = { all: "全ロール", admin: "管理者", moderator: "モデレーター" };
              const activeColors = { all: "bg-slate-700", admin: "bg-red-600", moderator: "bg-purple-600" };
              return (
                <button
                  type="button"
                  key={f}
                  onClick={() => setRoleFilter(f)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    roleFilter === f ? `${activeColors[f]} text-white` : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>

          {/* 検索 */}
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="実行者・対象・詳細で検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          {/* エクスポート */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800"
            >
              <Download size={14} /> CSV
            </button>
            <button
              type="button"
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 rounded-lg bg-slate-600 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              <Download size={14} /> JSON
            </button>
          </div>
        </div>

        {/* ログ一覧 */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="📋" title="ログが見つかりません" description="条件に一致する操作ログはありません。" />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["日時", "実行者", "アクション", "対象", "詳細", "IP"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="font-medium text-slate-800">{log.actor_email ?? "—"}</div>
                        {log.actor_role && (
                          <div className="text-xs text-slate-400">{log.actor_role}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getActionColor(log.action)}`}>
                          {getActionLabel(log.action)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {log.target_type && (
                          <div className="text-slate-700">{log.target_type}</div>
                        )}
                        {log.target_name && (
                          <div className="text-xs text-slate-500">{log.target_name}</div>
                        )}
                        {log.target_id && (
                          <div className="text-xs text-slate-400">ID: {log.target_id}</div>
                        )}
                        {!log.target_type && !log.target_name && "—"}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-slate-500">
                        {log.details || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                        {log.ip_address || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
              {filtered.length} 件表示 / 全 {totalCount} 件（直近 {logs.length} 件ロード済み）
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
