"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader, EmptyState } from "@/components/admin";
import { showToast } from "@/lib/admin/toast";
import type { Report, ReportStatus } from "@/app/api/admin/reports/route";

const STATUS_LABELS: Record<ReportStatus, string> = {
  open: "未対応",
  in_review: "確認中",
  resolved: "解決済み",
  dismissed: "却下",
};

const STATUS_COLORS: Record<ReportStatus, string> = {
  open: "bg-red-100 text-red-800",
  in_review: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  dismissed: "bg-gray-100 text-gray-600",
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  vendor: "出店者",
  content: "投稿コンテンツ",
  kotodute: "ことづて",
};

export default function AdminReportsPage() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("open");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isModerator) {
      router.push("/");
    }
  }, [isLoading, permissions.isModerator, router]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("target_type", typeFilter);
      const res = await fetch(`/api/admin/reports?${params.toString()}`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json() as { reports: Report[] };
      setReports(data.reports);
    } catch {
      showToast.error("通報データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    if (!permissions.isModerator) return;
    void fetchReports();
  }, [fetchReports, permissions.isModerator]);

  const handleStatusChange = async (report: Report, newStatus: ReportStatus) => {
    setUpdating(true);
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: report.id,
          status: newStatus,
          resolution_notes: resolutionNotes || undefined,
        }),
      });
      if (!res.ok) throw new Error("failed");
      showToast.success(`ステータスを「${STATUS_LABELS[newStatus]}」に変更しました`);
      setSelectedReport(null);
      setResolutionNotes("");
      void fetchReports();
    } catch {
      showToast.error("ステータス更新に失敗しました");
    } finally {
      setUpdating(false);
    }
  };

  const targetLink = (report: Report): string | null => {
    if (report.target_type === "vendor") return `/shops/${report.target_id}`;
    return null;
  };

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="モデレーション"
        title="通報管理"
      />

      {/* フィルター */}
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ReportStatus | "all")}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
        >
          <option value="all">すべてのステータス</option>
          {(Object.entries(STATUS_LABELS) as [ReportStatus, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
        >
          <option value="all">すべての対象</option>
          {Object.entries(TARGET_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* 通報一覧 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">読み込み中...</div>
      ) : reports.length === 0 ? (
        <EmptyState title="該当する通報はありません" />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[report.status]}`}>
                      {STATUS_LABELS[report.status]}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {TARGET_TYPE_LABELS[report.target_type] ?? report.target_type}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">{report.reason}</span>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    {(() => {
                      const link = targetLink(report);
                      return link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-amber-700 hover:underline"
                        >
                          {report.target_name ?? report.target_id}
                        </a>
                      ) : (
                        <span className="text-sm font-medium text-slate-700">
                          {report.target_name ?? report.target_id}
                        </span>
                      );
                    })()}
                  </div>

                  {report.details && (
                    <p className="mt-1.5 text-sm text-slate-600">{report.details}</p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-slate-400">
                    <span>{new Date(report.created_at).toLocaleString("ja-JP")}</span>
                    {report.reporter_email && <span>通報者: {report.reporter_email}</span>}
                  </div>

                  {report.resolution_notes && (
                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      対応メモ: {report.resolution_notes}
                    </p>
                  )}
                </div>

                {/* アクションボタン */}
                {report.status === "open" || report.status === "in_review" ? (
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {report.status === "open" && (
                      <button
                        type="button"
                        onClick={() => void handleStatusChange(report, "in_review")}
                        disabled={updating}
                        className="rounded-lg bg-yellow-100 px-3 py-1.5 text-xs font-semibold text-yellow-800 hover:bg-yellow-200 disabled:opacity-40"
                      >
                        確認中にする
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setSelectedReport(report); setResolutionNotes(""); }}
                      className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-200"
                    >
                      解決済みにする
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStatusChange(report, "dismissed")}
                      disabled={updating}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-40"
                    >
                      却下する
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 解決メモモーダル */}
      {selectedReport && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => !updating && setSelectedReport(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-slate-900">解決済みにする</h2>
            <p className="mt-1 text-xs text-slate-500">
              「{selectedReport.target_name ?? selectedReport.target_id}」の通報を解決済みとしてマークします。
            </p>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="対応内容メモ（任意）"
              rows={3}
              maxLength={500}
              className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void handleStatusChange(selectedReport, "resolved")}
                disabled={updating}
                className="flex-1 rounded-xl bg-green-600 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {updating ? "処理中..." : "解決済みにする"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                disabled={updating}
                className="flex-1 rounded-xl bg-slate-100 py-2 text-sm font-medium text-slate-700"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
