"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { exportToCSV, exportToJSON, formatDateForFilename } from "@/lib/admin/exportUtils";
import { showToast } from "@/lib/admin/toast";
import { StatusBadge, LoadingButton, EmptyState, ErrorBoundary, AdminLayout, AdminPageHeader } from "@/components/admin";
import { Loader2, Search } from "lucide-react";
import { useDebounce } from "use-debounce";

type KotoduteStatus = "published" | "hidden" | "deleted";

type Kotodute = {
  id: string;
  visitor_key: string;
  vendor_id: string | null;
  shop_name: string | null;
  body: string;
  status: KotoduteStatus;
  report_count: number;
  created_at: string;
};

type DbRow = {
  id: string;
  visitor_key: string;
  vendor_id: string | null;
  body: string;
  status: string;
  report_count: number;
  created_at: string;
  vendors: { shop_name: string | null } | null;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function getStatusLabel(status: KotoduteStatus) {
  return { published: "公開中", hidden: "非公開", deleted: "削除済み" }[status];
}

export function ModeratorKotoduteContent() {
  const { permissions, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Kotodute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | KotoduteStatus>("all");
  const [shopFilter, setShopFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!permissions.canModerateContent) router.push("/");
  }, [authLoading, permissions.canModerateContent, router]);

  const load = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("kotodutes")
      .select("id, visitor_key, vendor_id, body, status, report_count, created_at, vendors(shop_name)")
      .order("created_at", { ascending: false });

    if (error) {
      showToast.error("データの取得に失敗しました");
      setIsLoading(false);
      return;
    }

    setItems(
      ((data ?? []) as DbRow[]).map((r) => ({
        id: r.id,
        visitor_key: r.visitor_key,
        vendor_id: r.vendor_id,
        shop_name: r.vendors?.shop_name ?? null,
        body: r.body,
        status: r.status as KotoduteStatus,
        report_count: r.report_count,
        created_at: r.created_at,
      }))
    );
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && permissions.canModerateContent) load();
  }, [authLoading, permissions.canModerateContent, load]);

  // 統計
  const stats = useMemo(() => ({
    total: items.length,
    published: items.filter((k) => k.status === "published").length,
    hidden: items.filter((k) => k.status === "hidden").length,
    deleted: items.filter((k) => k.status === "deleted").length,
    reported: items.filter((k) => k.report_count > 0).length,
  }), [items]);

  // ユニーク店舗
  const uniqueShops = useMemo(() => {
    const shops = new Set(items.filter((k) => k.shop_name).map((k) => k.shop_name!));
    return Array.from(shops).sort();
  }, [items]);

  // フィルタリング
  const filtered = useMemo(() => {
    return items.filter((k) => {
      if (filter !== "all" && k.status !== filter) return false;
      if (shopFilter !== "all" && k.shop_name !== shopFilter) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        return (
          k.body.toLowerCase().includes(q) ||
          (k.shop_name ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, filter, shopFilter, debouncedSearch]);

  // ステータス変更
  const updateStatus = useCallback(async (ids: string[], status: KotoduteStatus, label: string) => {
    setActionLoading(true);
    try {
      const url = ids.length === 1
        ? `/api/admin/kotodute/${ids[0]}`
        : "/api/admin/kotodute/bulk";
      const body = ids.length === 1 ? { status } : { ids, status };
      const res = await fetch(url, {
        method: ids.length === 1 ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.map((k) => ids.includes(k.id) ? { ...k, status } : k));
      setSelectedIds([]);
      showToast.success(`${ids.length}件を${label}にしました`);
    } catch {
      showToast.error("操作に失敗しました");
    } finally {
      setActionLoading(false);
    }
  }, []);

  const handleBulkUpdate = useCallback(async (status: KotoduteStatus, label: string) => {
    if (selectedIds.length === 0) return;
    if (!confirm(`${selectedIds.length}件を${label}にしますか？`)) return;
    await updateStatus(selectedIds, status, label);
  }, [selectedIds, updateStatus]);

  // エクスポート
  const handleExportCSV = useCallback(async () => {
    setIsExporting(true);
    try {
      const result = exportToCSV(
        filtered.map((k) => ({
          ID: k.id,
          店舗名: k.shop_name ?? "",
          本文: k.body,
          ステータス: getStatusLabel(k.status),
          報告数: String(k.report_count),
          投稿日時: k.created_at,
        })),
        `kotodute_${formatDateForFilename()}.csv`
      );
      if (result.success) showToast.success("CSVをエクスポートしました");
      else showToast.error(result.error ?? "エクスポートに失敗しました");
    } finally {
      setIsExporting(false);
    }
  }, [filtered]);

  const handleExportJSON = useCallback(async () => {
    setIsExporting(true);
    try {
      const result = exportToJSON(filtered, `kotodute_${formatDateForFilename()}.json`);
      if (result.success) showToast.success("JSONをエクスポートしました");
      else showToast.error(result.error ?? "エクスポートに失敗しました");
    } finally {
      setIsExporting(false);
    }
  }, [filtered]);

  if (authLoading || !permissions.canModerateContent) return null;

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="Kotodute"
        title="ことづて管理"
        actions={
          <>
            <LoadingButton onClick={handleExportCSV} isLoading={isExporting} loadingText="出力中..."
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800">
              CSV出力
            </LoadingButton>
            <LoadingButton onClick={handleExportJSON} isLoading={isExporting} loadingText="出力中..."
              className="rounded-lg bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-700">
              JSON出力
            </LoadingButton>
          </>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-8 pb-20">

        {/* 統計カード */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            { label: "総投稿数", value: stats.total, color: "text-slate-800" },
            { label: "公開中", value: stats.published, color: "text-green-700" },
            { label: "非公開", value: stats.hidden, color: "text-orange-600" },
            { label: "削除済み", value: stats.deleted, color: "text-slate-400" },
            { label: "報告あり", value: stats.reported, color: "text-red-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">{s.label}</p>
              <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* フィルター・検索 */}
        <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase">ステータス:</span>
            {([
              { f: "all" as const, label: `すべて (${stats.total})`, active: "bg-gray-700" },
              { f: "published" as const, label: `公開中 (${stats.published})`, active: "bg-green-700" },
              { f: "hidden" as const, label: `非公開 (${stats.hidden})`, active: "bg-orange-600" },
              { f: "deleted" as const, label: `削除済み (${stats.deleted})`, active: "bg-gray-600" },
            ]).map(({ f, label, active }) => (
              <button type="button" key={f} onClick={() => setFilter(f)}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${filter === f ? `${active} text-white` : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {label}
              </button>
            ))}
            <div className="relative ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="本文・店舗名で検索..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56 rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm focus:border-slate-500 focus:outline-none" />
            </div>
          </div>

          {uniqueShops.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <span className="text-xs font-medium text-slate-500 uppercase">店舗:</span>
              <button type="button" onClick={() => setShopFilter("all")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${shopFilter === "all" ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                すべて
              </button>
              {uniqueShops.map((s) => (
                <button type="button" key={s} onClick={() => setShopFilter(s)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${shopFilter === s ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 一括操作バー */}
        {selectedIds.length > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-800">{selectedIds.length}件選択中</span>
              <button type="button" onClick={() => setSelectedIds([])} className="text-sm text-slate-500 hover:text-slate-700">選択解除</button>
            </div>
            <div className="flex gap-2">
              <LoadingButton onClick={() => handleBulkUpdate("published", "公開")} isLoading={actionLoading} loadingText="処理中..."
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800">
                一括公開
              </LoadingButton>
              <LoadingButton onClick={() => handleBulkUpdate("hidden", "非公開")} isLoading={actionLoading} loadingText="処理中..."
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">
                一括非公開
              </LoadingButton>
              <LoadingButton onClick={() => handleBulkUpdate("deleted", "削除")} isLoading={actionLoading} loadingText="処理中..."
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                一括削除
              </LoadingButton>
            </div>
          </div>
        )}

        {/* 一覧 */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="💬" title="ことづてが見つかりません"
            description={debouncedSearch ? "検索条件に一致するものはありません。" : "この条件のことづてはありません。"} />
        ) : (
          <div className="space-y-3">
            {filtered.map((k) => (
              <div key={k.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <input type="checkbox" checked={selectedIds.includes(k.id)}
                    onChange={() => setSelectedIds((prev) =>
                      prev.includes(k.id) ? prev.filter((id) => id !== k.id) : [...prev, k.id]
                    )}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-slate-700 focus:ring-slate-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {k.shop_name && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                          🏪 {k.shop_name}
                        </span>
                      )}
                      <StatusBadge status={k.status} />
                      {k.report_count > 0 && (
                        <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                          🚨 {k.report_count}件の報告
                        </span>
                      )}
                      <span className="ml-auto text-xs text-slate-400">{formatDate(k.created_at)}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-700">{k.body}</p>
                  </div>
                </div>

                {/* アクションボタン */}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  {k.status === "published" && (
                    <>
                      <button type="button" onClick={() => updateStatus([k.id], "hidden", "非公開")} disabled={actionLoading}
                        className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">
                        🔒 非公開
                      </button>
                      <button type="button" onClick={() => updateStatus([k.id], "deleted", "削除")} disabled={actionLoading}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                        🗑️ 削除
                      </button>
                    </>
                  )}
                  {k.status === "hidden" && (
                    <>
                      <button type="button" onClick={() => updateStatus([k.id], "published", "公開")} disabled={actionLoading}
                        className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50">
                        ✓ 公開
                      </button>
                      <button type="button" onClick={() => updateStatus([k.id], "deleted", "削除")} disabled={actionLoading}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                        🗑️ 削除
                      </button>
                    </>
                  )}
                  {k.status === "deleted" && (
                    <button type="button" onClick={() => updateStatus([k.id], "published", "公開（復元）")} disabled={actionLoading}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                      ↺ 復元
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default function ModeratorKotodutePage() {
  return (
    <ErrorBoundary>
      <ModeratorKotoduteContent />
    </ErrorBoundary>
  );
}
