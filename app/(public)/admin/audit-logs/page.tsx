"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  AdminDataTable,
  AdminLayout,
  AdminPageHeader,
  EmptyState,
  ExportActions,
  FilterChip,
  ReviewStats,
  ReviewToolbar,
  useListExport,
  type DataColumn,
} from "@/components/admin";
import { useSortableData } from "@/components/admin/desktop/SortableTableHeader";
import { showToast } from "@/lib/admin/toast";
import { excelText } from "@/lib/admin/exportUtils";
import { Badge } from "@/components/ui";
import { CenteredLoading } from "@/components/ui/loading-spinner";

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
  ai_model_updated: "AIモデル変更",
  ai_conversation_setting_updated: "AI会話設定変更",
  bulk_operation: "一括操作",
  data_export: "データエクスポート",
  login: "ログイン",
  logout: "ログアウト",
};

function getActionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

/** 操作の札。消す・止める＝注意、作る・承認＝良い、変える＝情報、それ以外は無地 */
function ActionBadge({ action }: { action: string }) {
  const label = getActionLabel(action);
  if (action.includes("deleted") || action === "shop_suspended") {
    return <Badge variant="caution">{label}</Badge>;
  }
  if (action.includes("approved") || action.includes("created")) {
    return <Badge className="bg-status-good-bg text-status-good-fg ring-status-good-line">{label}</Badge>;
  }
  if (action.includes("updated") || action.includes("changed") || action === "bulk_operation") {
    return <Badge variant="info">{label}</Badge>;
  }
  return <Badge>{label}</Badge>;
}

type DateFilter = "all" | "today" | "week" | "month";
type RoleFilter = "all" | "admin" | "moderator";

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "today", label: "今日" },
  { key: "week", label: "7日間" },
  { key: "month", label: "30日間" },
];

const COLUMNS: DataColumn<AuditLog>[] = [
  {
    key: "created_at",
    header: "日時",
    sortKey: "created_at",
    className: "w-40 whitespace-nowrap text-xs",
    render: (log) => formatDate(log.created_at),
  },
  {
    key: "actor",
    header: "実行者",
    sortKey: "actor_email",
    className: "whitespace-nowrap",
    render: (log) => (
      <>
        <div className="font-medium text-nicchyo-ink">{log.actor_email ?? "—"}</div>
        {log.actor_role && <div className="text-xs text-nicchyo-ink/40">{log.actor_role}</div>}
      </>
    ),
  },
  {
    key: "action",
    header: "アクション",
    sortKey: "action",
    className: "whitespace-nowrap",
    render: (log) => <ActionBadge action={log.action} />,
  },
  {
    key: "target",
    header: "対象",
    className: "whitespace-nowrap",
    render: (log) => (
      <>
        {log.target_type && <div className="text-nicchyo-ink/80">{log.target_type}</div>}
        {log.target_name && <div className="text-xs text-nicchyo-ink/55">{log.target_name}</div>}
        {log.target_id && <div className="text-xs text-nicchyo-ink/40">ID: {log.target_id}</div>}
        {!log.target_type && !log.target_name && "—"}
      </>
    ),
  },
  {
    key: "details",
    header: "詳細",
    className: "max-w-xs truncate",
    render: (log) => log.details || "—",
  },
  {
    key: "ip",
    header: "IP",
    className: "whitespace-nowrap text-xs text-nicchyo-ink/40",
    render: (log) => log.ip_address || "—",
  },
];

function toCsvRow(l: AuditLog) {
  return {
    日時: excelText(formatDate(l.created_at)),
    実行者: l.actor_email ?? "",
    ロール: l.actor_role ?? "",
    アクション: getActionLabel(l.action),
    対象種別: l.target_type ?? "",
    対象ID: l.target_id ?? "",
    対象名: l.target_name ?? "",
    詳細: l.details ?? "",
    IPアドレス: l.ip_address ?? "",
  };
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
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  useEffect(() => {
    if (authLoading) return;
    if (!permissions.isAdmin) router.push("/");
  }, [authLoading, permissions.isAdmin, router]);

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
    if (!authLoading && permissions.isAdmin) load();
  }, [authLoading, permissions.isAdmin, load]);

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

  // 並べ替えは見出しを押したときだけ。押すまでは API の順（新しい順）のまま
  const { sortedData, sortKey, sortDirection, handleSort } = useSortableData(filtered);

  const { isExporting, exportCsv, exportJson } = useListExport({ prefix: "audit_logs", rows: filtered, toCsvRow });

  if (authLoading || !permissions.isAdmin) return null;

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="Audit"
        title="監査ログ"
        actions={<ExportActions onCsv={exportCsv} onJson={exportJson} loading={isExporting} />}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 pb-20">
        <ReviewStats
          items={[
            { label: "総ログ数", value: totalCount },
            { label: "本日のアクション", value: stats.todayCount, tone: "info" },
            { label: "管理者操作", value: stats.adminCount, tone: "critical" },
            { label: "モデレーター操作", value: stats.modCount, tone: "warning" },
          ]}
        />

        <ReviewToolbar
          filters={[
            { key: "all", label: "全ロール", count: logs.length },
            { key: "admin", label: "管理者", count: stats.adminCount },
            { key: "moderator", label: "モデレーター", count: stats.modCount },
          ]}
          value={roleFilter}
          onChange={setRoleFilter}
          search={{ value: search, onChange: setSearch, placeholder: "実行者・対象・詳細で検索..." }}
        >
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-xs font-medium text-nicchyo-ink/55">期間</span>
            {DATE_FILTERS.map((f) => (
              <FilterChip size="sm" key={f.key} active={dateFilter === f.key} onClick={() => setDateFilter(f.key)}>
                {f.label}
              </FilterChip>
            ))}
          </div>
        </ReviewToolbar>

        {isLoading ? (
          <CenteredLoading padding="py-16" className="text-nicchyo-ink/40" />
        ) : filtered.length === 0 ? (
          <EmptyState icon="📋" title="ログが見つかりません" description="条件に一致する操作ログはありません。" />
        ) : (
          <>
            <AdminDataTable
              rows={sortedData}
              getRowId={(log) => String(log.id)}
              columns={COLUMNS}
              sort={{ key: sortKey, direction: sortDirection, onSort: handleSort }}
            />
            <p className="mt-3 text-xs text-nicchyo-ink/40">
              {filtered.length} 件表示 / 全 {totalCount} 件（直近 {logs.length} 件ロード済み）
            </p>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
