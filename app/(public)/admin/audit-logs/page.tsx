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
import type { AuditLogPeriod, AuditLogRoleFilter } from "@/app/api/admin/audit-logs/route";
import { describeAuditLog, roleLabel, type AuditFact, type AuditLogView } from "@/lib/audit/auditLogDisplay";

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

/** 画面に出す1行。読める形（view）と、並べ替え用の札の名前を添える */
type AuditLogRow = AuditLog & { view: AuditLogView; actionLabel: string };

/** 操作の札。消す・止める＝注意、作る・承認＝良い、変える＝情報、それ以外は無地 */
function ActionBadge({ view }: { view: AuditLogView }) {
  if (view.tone === "caution") return <Badge variant="caution">{view.actionLabel}</Badge>;
  if (view.tone === "good") {
    return <Badge className="bg-status-good-bg text-status-good-fg ring-status-good-line">{view.actionLabel}</Badge>;
  }
  if (view.tone === "info") return <Badge variant="info">{view.actionLabel}</Badge>;
  return <Badge>{view.actionLabel}</Badge>;
}

type AuditLogStats = { total: number; today: number; admin: number; moderator: number };
const EMPTY_STATS: AuditLogStats = { total: 0, today: 0, admin: 0, moderator: 0 };

const DATE_FILTERS: { key: AuditLogPeriod; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "today", label: "今日" },
  { key: "week", label: "7日間" },
  { key: "month", label: "30日間" },
];

function FactList({ facts }: { facts: AuditFact[] }) {
  return (
    <dl className="space-y-0.5 text-xs">
      {facts.map((f) => (
        <div key={f.label} className="flex gap-1.5">
          <dt className="shrink-0 text-nicchyo-ink/55">{f.label}：</dt>
          <dd className="min-w-0 break-words text-nicchyo-ink/80">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const COLUMNS: DataColumn<AuditLogRow>[] = [
  {
    key: "created_at",
    header: "日時",
    sortKey: "created_at",
    className: "w-36 whitespace-nowrap text-xs",
    render: (log) => formatDate(log.created_at),
  },
  {
    key: "actor",
    header: "誰が",
    sortKey: "actor_email",
    className: "w-56",
    render: (log) => (
      <>
        <div className="break-all font-medium text-nicchyo-ink">{log.actor_email ?? "—"}</div>
        {log.actor_role && <div className="text-xs text-nicchyo-ink/55">{roleLabel(log.actor_role)}</div>}
      </>
    ),
  },
  {
    key: "action",
    header: "何をした",
    sortKey: "actionLabel",
    className: "min-w-[280px]",
    render: (log) => (
      <div className="space-y-1">
        <ActionBadge view={log.view} />
        <p className="text-sm text-nicchyo-ink">{log.view.summary}</p>
      </div>
    ),
  },
  {
    key: "details",
    header: "くわしく",
    className: "min-w-[240px]",
    render: (log) => (
      <div className="space-y-1.5">
        {log.view.facts.length > 0 ? <FactList facts={log.view.facts} /> : <span className="text-xs text-nicchyo-ink/40">—</span>}
        {/* ID や元の値は、調べものをする人のためにしまっておく */}
        <details className="text-xs">
          <summary className="cursor-pointer text-nicchyo-ink/40 hover:text-nicchyo-ink/70">技術的な情報</summary>
          <div className="mt-1 rounded-btn bg-nicchyo-ink/[0.04] p-2">
            <FactList facts={log.view.technical} />
          </div>
        </details>
      </div>
    ),
  },
];

function toCsvRow(l: AuditLogRow) {
  return {
    日時: excelText(formatDate(l.created_at)),
    実行者: l.actor_email ?? "",
    ロール: roleLabel(l.actor_role) ?? "",
    操作: l.view.actionLabel,
    内容: l.view.summary,
    くわしく: l.view.facts.map((f) => `${f.label}: ${f.value}`).join(" / "),
    操作の名前: l.action,
    対象種別: l.target_type ?? "",
    対象ID: l.target_id ?? "",
    対象名: l.target_name ?? "",
    記録された内容: l.details ?? "",
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
  const [stats, setStats] = useState<AuditLogStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<AuditLogPeriod>("all");
  const [roleFilter, setRoleFilter] = useState<AuditLogRoleFilter>("all");

  useEffect(() => {
    if (authLoading) return;
    if (!permissions.isAdmin) router.push("/");
  }, [authLoading, permissions.isAdmin, router]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      // 期間・ロールは API が DB で絞る。読み込む上限（新しい順に500件）より古い記録も、絞り込めば出てくる
      const params = new URLSearchParams({ period: dateFilter, role: roleFilter });
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (!res.ok) throw new Error(res.statusText);
      const json = await res.json() as { logs: AuditLog[]; total: number; stats?: AuditLogStats };
      setLogs(json.logs ?? []);
      setTotalCount(json.total ?? 0);
      setStats(json.stats ?? EMPTY_STATS);
    } catch {
      showToast.error("ログの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [dateFilter, roleFilter]);

  useEffect(() => {
    if (!authLoading && permissions.isAdmin) load();
  }, [authLoading, permissions.isAdmin, load]);

  const rows = useMemo<AuditLogRow[]>(
    () =>
      logs.map((log) => {
        const view = describeAuditLog(log);
        return { ...log, view, actionLabel: view.actionLabel };
      }),
    [logs]
  );

  // 検索だけは読み込んだ分の中で絞る。画面に出ている言葉（内容・くわしく）でも、元の値でも引ける
  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) =>
      [
        row.actor_email,
        row.target_name,
        row.details,
        row.view.actionLabel,
        row.view.summary,
        ...row.view.facts.map((f) => f.value),
      ].some((text) => (text ?? "").toLowerCase().includes(q))
    );
  }, [rows, search]);

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
            { label: "総ログ数", value: stats.total },
            { label: "本日のアクション", value: stats.today, tone: "info" },
            { label: "管理者操作", value: stats.admin, tone: "critical" },
            { label: "モデレーター操作", value: stats.moderator, tone: "warning" },
          ]}
        />

        <ReviewToolbar
          filters={[
            { key: "all", label: "全ロール", count: stats.total },
            { key: "admin", label: "管理者", count: stats.admin },
            { key: "moderator", label: "モデレーター", count: stats.moderator },
          ]}
          value={roleFilter}
          onChange={setRoleFilter}
          search={{ value: search, onChange: setSearch, placeholder: "誰が・何を・内容で検索..." }}
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
              {filtered.length} 件表示 / 条件に合う {totalCount} 件
              {totalCount > logs.length && `（新しい順に ${logs.length} 件まで読み込み。期間やロールで絞ると古い記録も出ます）`}
            </p>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
