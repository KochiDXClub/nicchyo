"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDebounce } from "use-debounce";
import { exportToCSV, exportToJSON, formatDateForFilename } from "@/lib/admin/exportUtils";
import { showToast } from "@/lib/admin/toast";
import { StatusBadge, LoadingButton, EmptyState, ErrorBoundary, AdminLayout } from "@/components/admin";
import { useKeyboardShortcuts, ShortcutHelp } from "@/lib/hooks/useKeyboardShortcuts";
import { SortableTableHeader, useSortableData } from "@/components/admin/desktop/SortableTableHeader";
import { Tooltip } from "@/components/admin/desktop/Tooltip";
import { DataDensityToggle, DENSITY_CONFIG, type DataDensity } from "@/components/admin/desktop/DataDensityToggle";
import type { AdminShop } from "@/app/api/admin/shops/route";

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

  const parentRef = useRef<HTMLTableSectionElement>(null);
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

  // 仮想化
  const rowVirtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => DENSITY_CONFIG[dataDensity].rowHeight,
    overscan: 5,
  });

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
        登録日: shop.registeredDate,
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

  return (
    <AdminLayout>
      {/* ヘッダー */}
      <div className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">店舗管理</h1>
            <div className="flex flex-wrap gap-2">
              <LoadingButton
                onClick={handleExportCSV}
                isLoading={isExporting}
                className="rounded-lg bg-green-600 px-3 py-2 text-white hover:bg-green-700 text-sm"
              >
                CSV出力
              </LoadingButton>
              <LoadingButton
                onClick={handleExportJSON}
                isLoading={isExporting}
                className="rounded-lg bg-purple-600 px-3 py-2 text-white hover:bg-purple-700 text-sm"
              >
                JSON出力
              </LoadingButton>
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="mx-auto max-w-7xl px-4 py-4 sm:py-8">
        {/* 統計カード */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-lg bg-white p-3 shadow sm:p-4">
            <p className="text-xs text-gray-600 sm:text-sm">総店舗数</p>
            <p className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">{stats.total}</p>
          </div>
          <div className="rounded-lg bg-green-50 p-3 shadow sm:p-4">
            <p className="text-xs text-green-600 sm:text-sm">稼働中</p>
            <p className="mt-1 text-xl font-bold text-green-600 sm:text-2xl">{stats.active}</p>
          </div>
          <div className="rounded-lg bg-red-50 p-3 shadow sm:p-4">
            <p className="text-xs text-red-600 sm:text-sm">停止中</p>
            <p className="mt-1 text-xl font-bold text-red-600 sm:text-2xl">{stats.suspended}</p>
          </div>
        </div>

        {/* エラー表示 */}
        {fetchError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 flex items-center justify-between">
            <p className="text-sm text-red-700">{fetchError}</p>
            <button
              type="button"
              onClick={loadShops}
              className="ml-4 rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
            >
              再試行
            </button>
          </div>
        )}

        {/* ローディング */}
        {fetchLoading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        )}

        {!fetchLoading && !fetchError && (
          <>
            {/* フィルター */}
            <div className="mb-4 rounded-lg bg-white p-4 shadow space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス:</span>
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${filter === "all" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    すべて ({stats.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter("active")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${filter === "active" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    稼働中 ({stats.active})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter("suspended")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${filter === "suspended" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    停止中 ({stats.suspended})
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <DataDensityToggle density={dataDensity} onChange={setDataDensity} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="店舗名・オーナーで検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none w-full sm:w-64"
                  />
                </div>
              </div>

              {/* カテゴリーフィルター */}
              {uniqueCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-gray-200">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">カテゴリー:</span>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter("all")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${categoryFilter === "all" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    すべて
                  </button>
                  {uniqueCategories.map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${categoryFilter === cat ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                    >
                      {cat} ({categoryStats[cat] ?? 0})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 一括操作ツールバー */}
            {selectedShopIds.length > 0 && (
              <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-blue-900">{selectedShopIds.length}件選択中</span>
                    <button type="button" onClick={() => setSelectedShopIds([])} className="text-sm text-blue-600 hover:text-blue-800">
                      解除
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <LoadingButton
                      onClick={handleBulkRestore}
                      isLoading={bulkLoading}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                    >
                      一括復活
                    </LoadingButton>
                    <LoadingButton
                      onClick={handleBulkSuspend}
                      isLoading={bulkLoading}
                      className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
                    >
                      一括停止
                    </LoadingButton>
                    <LoadingButton
                      onClick={handleBulkDelete}
                      isLoading={bulkLoading}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                    >
                      一括削除
                    </LoadingButton>
                  </div>
                </div>
              </div>
            )}

            {/* 店舗リスト */}
            {filteredShops.length === 0 ? (
              <EmptyState
                icon="🏪"
                title="店舗が見つかりません"
                description="検索条件に一致する店舗がありません。"
              />
            ) : (
              <>
                {/* PC: テーブル */}
                <div className="hidden sm:block rounded-lg bg-white shadow">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left">
                            <Tooltip content="全選択/解除 (Ctrl+A)" position="top">
                              <input
                                type="checkbox"
                                checked={selectedShopIds.length === filteredShops.length && filteredShops.length > 0}
                                onChange={handleSelectAll}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                              />
                            </Tooltip>
                          </th>
                          <SortableTableHeader label="店舗" sortKey="name" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                          <SortableTableHeader label="カテゴリー" sortKey="category" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                          <SortableTableHeader label="オーナー" sortKey="owner" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                          <SortableTableHeader label="ステータス" sortKey="status" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                          <SortableTableHeader label="登録日" sortKey="registeredDate" currentSortKey={sortKey} currentSortDirection={sortDirection} onSort={handleSort} />
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">アクション</th>
                        </tr>
                      </thead>
                      <tbody
                        ref={parentRef}
                        className="divide-y divide-gray-200 bg-white"
                        style={{ height: "560px", overflow: "auto" }}
                      >
                        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
                          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                            const shop = sortedData[virtualRow.index];
                            return (
                              <tr
                                key={shop.id}
                                className="hover:bg-gray-50"
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  width: "100%",
                                  height: `${virtualRow.size}px`,
                                  transform: `translateY(${virtualRow.start}px)`,
                                }}
                              >
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedShopIds.includes(shop.id)}
                                    onChange={(e) => handleSelectShop(shop.id, virtualRow.index, (e.nativeEvent as MouseEvent).shiftKey)}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-gray-900 text-sm">{shop.name}</div>
                                  <div className="text-xs text-gray-400">{shop.email}</div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">{shop.category}</td>
                                <td className="px-4 py-3 text-sm text-gray-500">{shop.owner}</td>
                                <td className="px-4 py-3">
                                  <StatusBadge status={shop.status} />
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">{shop.registeredDate}</td>
                                <td className="px-4 py-3 text-right text-sm whitespace-nowrap">
                                  {shop.status === "active" ? (
                                    <button
                                      type="button"
                                      onClick={() => handleSingleAction(shop.id, "suspend")}
                                      className="text-orange-600 hover:text-orange-900 mr-3"
                                    >
                                      停止
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleSingleAction(shop.id, "restore")}
                                      className="text-green-600 hover:text-green-900 mr-3"
                                    >
                                      復活
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleSingleAction(shop.id, "delete")}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    削除
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </div>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* モバイル: カードリスト */}
                <div className="sm:hidden space-y-3">
                  {filteredShops.map((shop) => (
                    <div key={shop.id} className="rounded-lg bg-white shadow p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedShopIds.includes(shop.id)}
                            onChange={() =>
                              setSelectedShopIds((prev) =>
                                prev.includes(shop.id) ? prev.filter((id) => id !== shop.id) : [...prev, shop.id]
                              )
                            }
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 mt-0.5"
                          />
                          <div>
                            <div className="font-medium text-gray-900">{shop.name}</div>
                            <div className="text-xs text-gray-500">{shop.category}</div>
                          </div>
                        </div>
                        <StatusBadge status={shop.status} />
                      </div>
                      <div className="text-xs text-gray-500 mb-3">
                        <span>オーナー: {shop.owner}</span>
                        <span className="mx-2">·</span>
                        <span>登録: {shop.registeredDate}</span>
                      </div>
                      <div className="flex gap-2">
                        {shop.status === "active" ? (
                          <button
                            type="button"
                            onClick={() => handleSingleAction(shop.id, "suspend")}
                            className="flex-1 rounded-lg border border-orange-300 py-1.5 text-sm text-orange-600 hover:bg-orange-50"
                          >
                            停止
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSingleAction(shop.id, "restore")}
                            className="flex-1 rounded-lg border border-green-300 py-1.5 text-sm text-green-600 hover:bg-green-50"
                          >
                            復活
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSingleAction(shop.id, "delete")}
                          className="flex-1 rounded-lg border border-red-300 py-1.5 text-sm text-red-600 hover:bg-red-50"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
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
