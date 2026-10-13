"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import { useDebounce } from "use-debounce";
import { exportToCSV, exportToJSON, formatDateForFilename, excelText } from "@/lib/admin/exportUtils";
import { showToast } from "@/lib/admin/toast";
import { StatusBadge, EmptyState, ErrorBoundary, AdminLayout, AdminPageHeader, ReviewStats, ReviewToolbar } from "@/components/admin";
import { Button, Surface } from "@/components/ui";
import { CenteredLoading } from "@/components/ui/loading-spinner";
import { useKeyboardShortcuts, ShortcutHelp } from "@/lib/hooks/useKeyboardShortcuts";
import { SortableColumnHeader, useSortableData } from "@/components/admin/desktop/SortableTableHeader";
import { Tooltip } from "@/components/admin/desktop/Tooltip";
import { DataDensityToggle, DENSITY_CONFIG, type DataDensity } from "@/components/admin/desktop/DataDensityToggle";
import type { AdminShop } from "@/app/api/admin/shops/route";
import { ListingStatusBadge } from "./ListingStatusBadge";
import Link from "next/link";

type ShopStatus = "active" | "suspended";

function AdminShopsContent() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();
  const [shops, setShops] = useState<AdminShop[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | ShopStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  const [selectedShopIds, setSelectedShopIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [dataDensity, setDataDensity] = useState<DataDensity>("standard");

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isAdmin) {
      router.push("/");
    }
  }, [isLoading, permissions.isAdmin, router]);

  const loadShops = useCallback(async () => {
    setFetchLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/admin/shops");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { shops: AdminShop[] };
      setShops(Array.isArray(data.shops) ? data.shops : []);
    } catch {
      setFetchError("店舗データの取得に失敗しました");
    } finally {
      setFetchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && permissions.isAdmin) {
      loadShops();
    }
  }, [isLoading, permissions.isAdmin, loadShops]);

  // ユニークカテゴリー
  const uniqueCategories = useMemo(() => {
    const categories = new Set(shops.map((s) => s.category));
    return Array.from(categories).sort();
  }, [shops]);

  // フィルタリング
  const filteredShops = useMemo(() => {
    return shops.filter((shop) => {
      const matchesStatus = filter === "all" || shop.status === filter;
      const matchesCategory = categoryFilter === "all" || shop.category === categoryFilter;
      const q = debouncedSearchQuery.toLowerCase();
      const matchesSearch =
        q === "" ||
        shop.name.toLowerCase().includes(q) ||
        shop.category.toLowerCase().includes(q) ||
        shop.owner.toLowerCase().includes(q) ||
        shop.email.toLowerCase().includes(q);
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [shops, filter, categoryFilter, debouncedSearchQuery]);

  // ソート
  const { sortedData, sortKey, sortDirection, handleSort } = useSortableData(filteredShops, "name");

  // 統計
  const stats = useMemo(
    () => ({
      total: shops.length,
      active: shops.filter((s) => s.status === "active").length,
      suspended: shops.filter((s) => s.status === "suspended").length,
    }),
    [shops]
  );

  // カテゴリー別統計
  const categoryStats = useMemo(() => {
    const s: Record<string, number> = {};
    shops.forEach((shop) => {
      s[shop.category] = (s[shop.category] || 0) + 1;
    });
    return s;
  }, [shops]);

  // チェックボックス操作
  const handleSelectAll = useCallback(() => {
    if (selectedShopIds.length === filteredShops.length) {
      setSelectedShopIds([]);
    } else {
      setSelectedShopIds(filteredShops.map((s) => s.id));
    }
  }, [selectedShopIds.length, filteredShops]);

  const handleSelectShop = useCallback(
    (shopId: string, index: number, shiftKey: boolean) => {
      if (shiftKey && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        const rangeIds = sortedData.slice(start, end + 1).map((s) => s.id);
        setSelectedShopIds((prev) => Array.from(new Set([...prev, ...rangeIds])));
      } else {
        setSelectedShopIds((prev) =>
          prev.includes(shopId) ? prev.filter((id) => id !== shopId) : [...prev, shopId]
        );
        setLastSelectedIndex(index);
      }
    },
    [lastSelectedIndex, sortedData]
  );

  // 一括操作（実API）
  const executeBulk = useCallback(
    async (action: "suspend" | "restore" | "delete", label: string) => {
      if (selectedShopIds.length === 0) return;
      if (!confirm(`${selectedShopIds.length}件の店舗を一括${label}しますか？`)) return;

      setBulkLoading(true);
      try {
        const res = await fetch("/api/admin/shops/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ids: selectedShopIds }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error ?? "エラー");
        showToast.success(`${selectedShopIds.length}件を${label}しました`);
        setSelectedShopIds([]);
        await loadShops();
      } catch (err) {
        showToast.error(`一括${label}に失敗しました: ${err instanceof Error ? err.message : ""}`);
      } finally {
        setBulkLoading(false);
      }
    },
    [selectedShopIds, loadShops]
  );

  const handleBulkSuspend = useCallback(() => executeBulk("suspend", "停止"), [executeBulk]);
  const handleBulkRestore = useCallback(() => executeBulk("restore", "復活"), [executeBulk]);
  const handleBulkDelete = useCallback(() => executeBulk("delete", "削除"), [executeBulk]);

  // 個別操作
  const handleSingleAction = useCallback(
    async (id: string, action: "suspend" | "restore" | "delete") => {
      const label = action === "suspend" ? "停止" : action === "restore" ? "復活" : "削除";
      if (!confirm(`この店舗を${label}しますか？`)) return;
      try {
        const res = await fetch("/api/admin/shops/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ids: [id] }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error ?? "エラー");
        showToast.success(`${label}しました`);
        await loadShops();
      } catch {
        showToast.error(`${label}に失敗しました`);
      }
    },
    [loadShops]
  );

  // エクスポート
  const handleExportCSV = useCallback(async () => {
    setIsExporting(true);
    try {
      const dataToExport = filteredShops.map((shop) => ({
        ID: shop.id,
        店舗名: shop.name,
        カテゴリー: shop.category,
        店主: shop.owner,
        メール: shop.email,
        ステータス: shop.status === "active" ? "稼働中" : "停止中",
        登録日: excelText(shop.registeredDate),
      }));
      const result = exportToCSV(dataToExport, `shops_${formatDateForFilename()}.csv`);
      if (result.success) showToast.success("CSVをエクスポートしました");
      else showToast.error(result.error ?? "エクスポートに失敗しました");
    } catch {
      showToast.error("エクスポートに失敗しました");
    } finally {
      setIsExporting(false);
    }
  }, [filteredShops]);

  const handleExportJSON = useCallback(async () => {
    setIsExporting(true);
    try {
      const result = exportToJSON(filteredShops, `shops_${formatDateForFilename()}.json`);
      if (result.success) showToast.success("JSONをエクスポートしました");
      else showToast.error(result.error ?? "エクスポートに失敗しました");
    } catch {
      showToast.error("エクスポートに失敗しました");
    } finally {
      setIsExporting(false);
    }
  }, [filteredShops]);

  // キーボードショートカット
  useKeyboardShortcuts([
    { key: "a", ctrl: true, description: "全選択", action: handleSelectAll },
    { key: "f", ctrl: true, description: "検索フォーカス", action: () => searchInputRef.current?.focus() },
    { key: "/", description: "検索フォーカス", action: () => searchInputRef.current?.focus() },
    { key: "e", ctrl: true, description: "CSV出力", action: handleExportCSV },
    { key: "?", description: "ショートカット一覧を表示", action: () => setShowShortcutHelp(true) },
  ]);

  if (isLoading || !permissions.isAdmin) {
    return null;
  }

  const cell = DENSITY_CONFIG[dataDensity];
  const allSelected = selectedShopIds.length === sortedData.length && sortedData.length > 0;

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="Shops"
        title="店舗管理"
        actions={
          <>
            <Button variant="quiet" size="sm" onClick={handleExportCSV} disabled={isExporting}>
              CSV出力
            </Button>
            <Button variant="quiet" size="sm" onClick={handleExportJSON} disabled={isExporting}>
              JSON出力
            </Button>
          </>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-8 pb-20">
        <ReviewStats
          items={[
            { label: "総店舗数", value: stats.total },
            { label: "稼働中", value: stats.active, tone: "good" },
            { label: "停止中", value: stats.suspended, tone: "warning" },
          ]}
        />

        {fetchError && (
          <div role="alert" className="mb-4 flex items-center justify-between rounded-card bg-status-critical-bg p-4 text-status-critical-fg ring-1 ring-status-critical-line">
            <p className="text-sm">{fetchError}</p>
            <Button variant="quiet" size="sm" onClick={loadShops}>再試行</Button>
          </div>
        )}

        {fetchLoading && <CenteredLoading padding="py-16" className="text-nicchyo-ink/40" />}

        {!fetchLoading && !fetchError && (
          <>
            <ReviewToolbar
              ref={searchInputRef}
              filters={[
                { key: "all", label: "すべて", count: stats.total },
                { key: "active", label: "稼働中", count: stats.active },
                { key: "suspended", label: "停止中", count: stats.suspended },
              ]}
              value={filter}
              onChange={setFilter}
              search={{ value: searchQuery, onChange: setSearchQuery, placeholder: "店舗名・オーナーで検索..." }}
              extra={<div className="hidden sm:block"><DataDensityToggle density={dataDensity} onChange={setDataDensity} /></div>}
            >
              {uniqueCategories.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <span className="text-xs font-medium text-nicchyo-ink/55">カテゴリー</span>
                  {["all", ...uniqueCategories].map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      aria-pressed={categoryFilter === cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`rounded-chip px-3 py-1 text-xs font-medium transition-colors ${
                        categoryFilter === cat
                          ? "bg-nicchyo-ink text-white"
                          : "bg-nicchyo-ink/[0.06] text-nicchyo-ink/70 hover:bg-nicchyo-ink/10"
                      }`}
                    >
                      {cat === "all" ? "すべて" : `${cat} (${categoryStats[cat] ?? 0})`}
                    </button>
                  ))}
                </div>
              )}
            </ReviewToolbar>

            {/* 一括操作ツールバー */}
            {selectedShopIds.length > 0 && (
              <div className="mb-4 flex flex-col gap-3 rounded-card bg-amber-50 p-3 ring-1 ring-amber-200 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-nicchyo-ink">{selectedShopIds.length}件選択中</span>
                  <button type="button" onClick={() => setSelectedShopIds([])} className="text-sm text-amber-800 underline hover:no-underline">
                    解除
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="quiet" size="sm" onClick={handleBulkRestore} disabled={bulkLoading}>一括復活</Button>
                  <Button variant="quiet" size="sm" onClick={handleBulkSuspend} disabled={bulkLoading}>一括停止</Button>
                  <Button variant="quiet" size="sm" className="text-rose-700 hover:bg-rose-50" onClick={handleBulkDelete} disabled={bulkLoading}>
                    一括削除
                  </Button>
                </div>
              </div>
            )}

            {sortedData.length === 0 ? (
              <EmptyState icon="🏪" title="店舗が見つかりません" description="検索条件に一致する店舗がありません。" />
            ) : (
              <>
                {/* PC: テーブル */}
                <div className="hidden overflow-hidden rounded-card bg-white shadow-card ring-1 ring-line sm:block">
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full min-w-[720px]">
                      <thead className="sticky top-0 z-10 bg-nicchyo-base">
                        <tr className="border-b border-line">
                          <th scope="col" className="w-10 px-4 py-3 text-left">
                            <Tooltip content="全選択/解除 (Ctrl+A)" position="top">
                              <input
                                type="checkbox"
                                aria-label="表示中の店舗をすべて選択"
                                checked={allSelected}
                                onChange={handleSelectAll}
                                className="h-4 w-4 rounded border-line accent-amber-600"
                              />
                            </Tooltip>
                          </th>
                          <SortableColumnHeader label="店舗" sortKey="name" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                          <SortableColumnHeader label="カテゴリー" sortKey="category" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                          <SortableColumnHeader label="オーナー" sortKey="owner" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                          <SortableColumnHeader label="ステータス" sortKey="status" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                          <SortableColumnHeader label="登録日" sortKey="registeredDate" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                          <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-nicchyo-ink/55">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {sortedData.map((shop, index) => (
                          <tr key={shop.id} className="hover:bg-nicchyo-base/60">
                            <td className={cell.padding}>
                              <input
                                type="checkbox"
                                aria-label={`${shop.name}を選択`}
                                checked={selectedShopIds.includes(shop.id)}
                                onChange={(e) => handleSelectShop(shop.id, index, (e.nativeEvent as MouseEvent).shiftKey)}
                                className="h-4 w-4 rounded border-line accent-amber-600"
                              />
                            </td>
                            <td className={cell.padding}>
                              <Link href={`/admin/shops/${shop.id}`} className={`font-medium text-nicchyo-ink hover:underline ${cell.fontSize}`}>
                                {shop.name}
                              </Link>
                              <div className="text-xs text-nicchyo-ink/55">{shop.email}</div>
                            </td>
                            <td className={`${cell.padding} ${cell.fontSize} text-nicchyo-ink/70`}>{shop.category}</td>
                            <td className={`${cell.padding} ${cell.fontSize} text-nicchyo-ink/70`}>{shop.owner}</td>
                            <td className={cell.padding}>
                              <StatusBadge status={shop.status} />
                              <div className="mt-1">
                                <ListingStatusBadge status={shop.listingStatus} />
                              </div>
                            </td>
                            <td className={`${cell.padding} ${cell.fontSize} whitespace-nowrap text-nicchyo-ink/70`}>{shop.registeredDate}</td>
                            <td className={`${cell.padding} whitespace-nowrap text-right`}>
                              <div className="flex justify-end gap-2">
                                {shop.status === "active" ? (
                                  <Button variant="quiet" size="sm" onClick={() => handleSingleAction(shop.id, "suspend")}>停止</Button>
                                ) : (
                                  <Button variant="quiet" size="sm" onClick={() => handleSingleAction(shop.id, "restore")}>復活</Button>
                                )}
                                <Button variant="quiet" size="sm" className="text-rose-700 hover:bg-rose-50" onClick={() => handleSingleAction(shop.id, "delete")}>
                                  削除
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* モバイル: カードリスト */}
                <ul className="space-y-3 sm:hidden">
                  {sortedData.map((shop) => (
                    <Surface as="li" key={shop.id} padding="sm">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            aria-label={`${shop.name}を選択`}
                            checked={selectedShopIds.includes(shop.id)}
                            onChange={() =>
                              setSelectedShopIds((prev) =>
                                prev.includes(shop.id) ? prev.filter((id) => id !== shop.id) : [...prev, shop.id]
                              )
                            }
                            className="mt-1 h-4 w-4 rounded border-line accent-amber-600"
                          />
                          <div>
                            <Link href={`/admin/shops/${shop.id}`} className="font-medium text-nicchyo-ink hover:underline">
                              {shop.name}
                            </Link>
                            <div className="text-xs text-nicchyo-ink/55">{shop.category}</div>
                            <div className="mt-1">
                              <ListingStatusBadge status={shop.listingStatus} />
                            </div>
                          </div>
                        </div>
                        <StatusBadge status={shop.status} />
                      </div>
                      <div className="mb-3 text-xs text-nicchyo-ink/55">
                        オーナー: {shop.owner}<span className="mx-2">·</span>登録: {shop.registeredDate}
                      </div>
                      <div className="flex gap-2">
                        {shop.status === "active" ? (
                          <Button variant="quiet" size="sm" className="flex-1" onClick={() => handleSingleAction(shop.id, "suspend")}>停止</Button>
                        ) : (
                          <Button variant="quiet" size="sm" className="flex-1" onClick={() => handleSingleAction(shop.id, "restore")}>復活</Button>
                        )}
                        <Button variant="quiet" size="sm" className="flex-1 text-rose-700 hover:bg-rose-50" onClick={() => handleSingleAction(shop.id, "delete")}>
                          削除
                        </Button>
                      </div>
                    </Surface>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      {/* ショートカットヘルプボタン（PCのみ） */}
      <div className="hidden sm:block">
        <Tooltip content="キーボードショートカット (?)">
          <button
            type="button"
            onClick={() => setShowShortcutHelp(true)}
            className="fixed bottom-8 right-8 w-12 h-12 bg-gray-800 hover:bg-gray-700 text-white rounded-full shadow-lg flex items-center justify-center z-40 transition"
            aria-label="ショートカット一覧"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </Tooltip>
      </div>

      {/* ショートカットヘルプモーダル */}
      {showShortcutHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowShortcutHelp(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">キーボードショートカット</h3>
              <button type="button" onClick={() => setShowShortcutHelp(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ShortcutHelp
              shortcuts={[
                { key: "a", ctrl: true, description: "全選択", action: () => {} },
                { key: "f", ctrl: true, description: "検索フォーカス", action: () => {} },
                { key: "/", description: "検索フォーカス", action: () => {} },
                { key: "e", ctrl: true, description: "CSV出力", action: () => {} },
                { key: "?", description: "このヘルプを表示", action: () => {} },
              ]}
            />
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default function AdminShopsPage() {
  return (
    <ErrorBoundary>
      <AdminShopsContent />
    </ErrorBoundary>
  );
}
