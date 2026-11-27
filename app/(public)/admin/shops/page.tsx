"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDebounce } from "use-debounce";
import { Search } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { excelText } from "@/lib/admin/exportUtils";
import { showToast } from "@/lib/admin/toast";
import {
  AdminDataTable,
  AdminLayout,
  AdminPageHeader,
  BulkActionBar,
  EmptyState,
  ErrorBoundary,
  ExportActions,
  FilterChip,
  ShortcutHelpLauncher,
  StatusBadge,
  useBulkAction,
  useListExport,
  useRowSelection,
  type DataColumn,
} from "@/components/admin";
import { Button } from "@/components/ui";
import { CenteredLoading } from "@/components/ui/loading-spinner";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useSortableData } from "@/components/admin/desktop/SortableTableHeader";
import type { AdminShop } from "@/app/api/admin/shops/route";
import { fetchShopClaims, issueClaims, type IssueResult } from "@/lib/admin/shopClaimsClient";
import type { ShopClaimState } from "@/lib/vendor/shopClaim";
import { ListingStatusBadge } from "./ListingStatusBadge";
import { ClaimStateBadge } from "./components/ClaimStateBadge";
import { IssuedQrPanel } from "./components/IssuedQrPanel";
import QrSheet from "./components/QrSheet";

type ShopStatus = "active" | "suspended";
type ClaimFilter = "all" | ShopClaimState;

const CLAIM_FILTERS: { key: ClaimFilter; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "unclaimed", label: "QR未発行" },
  { key: "qr_issued", label: "QR発行済み" },
  { key: "claimed", label: "代表者あり" },
];

const DANGER = "text-rose-700 hover:bg-rose-50";

function AdminShopsContent() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();
  const [shops, setShops] = useState<AdminShop[]>([]);
  // 店舗ごとの代表者の紐づけ状態（vendorId → 状態）。取れなくても一覧は出す
  const [claimStates, setClaimStates] = useState<Map<string, ShopClaimState>>(new Map());
  const [claimFilter, setClaimFilter] = useState<ClaimFilter>("all");
  const [issuing, setIssuing] = useState(false);
  const [issueResults, setIssueResults] = useState<IssueResult[] | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | ShopStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

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
      try {
        setClaimStates(new Map((await fetchShopClaims()).map((c) => [c.vendorId, c.state])));
      } catch {
        showToast.error("代表者・QRの状態を読み込めませんでした");
      }
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

  const uniqueCategories = useMemo(() => Array.from(new Set(shops.map((s) => s.category))).sort(), [shops]);

  const filteredShops = useMemo(() => {
    const q = debouncedSearchQuery.toLowerCase();
    return shops.filter((shop) => {
      const matchesStatus = filter === "all" || shop.status === filter;
      const matchesClaim = claimFilter === "all" || claimStates.get(shop.id) === claimFilter;
      const matchesCategory = categoryFilter === "all" || shop.category === categoryFilter;
      const matchesSearch =
        q === "" ||
        shop.name.toLowerCase().includes(q) ||
        shop.category.toLowerCase().includes(q) ||
        shop.owner.toLowerCase().includes(q) ||
        shop.email.toLowerCase().includes(q);
      return matchesStatus && matchesClaim && matchesCategory && matchesSearch;
    });
  }, [shops, filter, claimFilter, claimStates, categoryFilter, debouncedSearchQuery]);

  const { sortedData, sortKey, sortDirection, handleSort } = useSortableData(filteredShops, "name");
  const rowIds = useMemo(() => sortedData.map((s) => s.id), [sortedData]);
  const selection = useRowSelection(rowIds);

  const stats = useMemo(
    () => ({
      total: shops.length,
      active: shops.filter((s) => s.status === "active").length,
      suspended: shops.filter((s) => s.status === "suspended").length,
    }),
    [shops]
  );

  const categoryStats = useMemo(() => {
    const s: Record<string, number> = {};
    shops.forEach((shop) => {
      s[shop.category] = (s[shop.category] || 0) + 1;
    });
    return s;
  }, [shops]);

  const { bulkLoading, runBulk, runSingle } = useBulkAction({
    endpoint: "/api/admin/shops/bulk",
    unit: "件",
    subject: "店舗",
    onDone: loadShops,
  });

  const handleBulk = useCallback(
    async (action: "suspend" | "restore" | "delete", label: string) => {
      if (await runBulk(action, selection.selectedIds, label)) selection.clear();
    },
    [runBulk, selection]
  );

  // QRの発行（再発行）。代表者がいる店舗には発行できないので、選んだうちそれ以外だけに発行する
  const handleIssueQr = useCallback(async () => {
    const targets = selection.selectedIds.filter((id) => claimStates.get(id) !== "claimed");
    const skipped = selection.selectedIds.length - targets.length;
    if (targets.length === 0) {
      showToast.error("代表者がいる店舗にはQRを発行できません。先に詳細で紐づけを解除してください");
      return;
    }
    if (!confirm(`${targets.length}店舗のQRコードを発行しますか？（発行済みのQRは使えなくなります）`)) return;
    setIssuing(true);
    try {
      const issued = await issueClaims(targets);
      setIssueResults(issued);
      selection.clear();
      const ok = issued.filter((r) => r.status === "ok").length;
      showToast.success(`${ok}店舗のQRコードを発行しました${skipped > 0 ? `（代表者がいる${skipped}店舗は対象外）` : ""}`);
      await loadShops();
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "QRコードを発行できませんでした");
    } finally {
      setIssuing(false);
    }
  }, [selection, claimStates, loadShops]);

  const { isExporting, exportCsv, exportJson } = useListExport({
    prefix: "shops",
    rows: filteredShops,
    toCsvRow: (shop: AdminShop) => ({
      ID: shop.id,
      店舗名: shop.name,
      カテゴリー: shop.category,
      店主: shop.owner,
      メール: shop.email,
      ステータス: shop.status === "active" ? "稼働中" : "停止中",
      登録日: excelText(shop.registeredDate),
    }),
  });

  const shortcuts = [
    { key: "a", ctrl: true, description: "全選択", action: selection.toggleAll },
    { key: "f", ctrl: true, description: "検索フォーカス", action: () => searchInputRef.current?.focus() },
    { key: "/", description: "検索フォーカス", action: () => searchInputRef.current?.focus() },
    { key: "e", ctrl: true, description: "CSV出力", action: exportCsv },
    { key: "?", description: "ショートカット一覧を表示", action: () => setShowShortcutHelp(true) },
  ];
  useKeyboardShortcuts(shortcuts);

  const columns: DataColumn<AdminShop>[] = [
    {
      key: "name",
      header: "店舗",
      sortKey: "name",
      className: "w-72",
      render: (shop) => (
        <>
          <Link href={`/admin/shops/${shop.id}`} className="text-sm font-medium text-nicchyo-ink hover:underline">
            {shop.name}
          </Link>
          <div className="truncate text-xs text-nicchyo-ink/55">{shop.email}</div>
        </>
      ),
    },
    { key: "category", header: "カテゴリー", sortKey: "category", className: "w-32", render: (shop) => shop.category },
    { key: "owner", header: "オーナー", sortKey: "owner", className: "w-32", render: (shop) => shop.owner },
    {
      key: "status",
      header: "ステータス",
      sortKey: "status",
      className: "w-32",
      render: (shop) => (
        <>
          <StatusBadge status={shop.status} />
          <div className="mt-1">
            <ListingStatusBadge status={shop.listingStatus} />
          </div>
        </>
      ),
    },
    {
      key: "claim",
      header: "代表者・QR",
      className: "w-36",
      render: (shop) =>
        claimStates.has(shop.id) ? (
          <ClaimStateBadge state={claimStates.get(shop.id)!} />
        ) : (
          <span className="text-xs text-nicchyo-ink/40">-</span>
        ),
    },
    { key: "registeredDate", header: "登録日", sortKey: "registeredDate", className: "w-28 whitespace-nowrap", render: (shop) => shop.registeredDate },
  ];

  const shopActions = (shop: AdminShop, size: "sm" | "md" = "sm") => (
    <>
      {shop.status === "active" ? (
        <Button variant="quiet" size={size} onClick={() => runSingle("suspend", shop.id, "停止")} aria-label={`${shop.name}を停止`}>停止</Button>
      ) : (
        <Button variant="quiet" size={size} onClick={() => runSingle("restore", shop.id, "復活")} aria-label={`${shop.name}を復活`}>復活</Button>
      )}
      <Button variant="quiet" size={size} className={DANGER} onClick={() => runSingle("delete", shop.id, "削除")} aria-label={`${shop.name}を削除`}>
        削除
      </Button>
    </>
  );

  if (isLoading || !permissions.isAdmin) {
    return null;
  }

  return (
    // 画面いっぱいの高さに収め、スクロールは表の本体だけにする（ユーザー管理と同じ形）
    <AdminLayout withBottomPadding={false}>
      <div className="flex h-[100dvh] flex-col">
        <div className="shrink-0">
          <AdminPageHeader
            eyebrow="Shops"
            title="店舗管理"
            actions={<ExportActions compact onCsv={exportCsv} onJson={exportJson} loading={isExporting} />}
          />
        </div>

        <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 pb-24 pt-3 sm:pb-4 sm:pt-4">
          {fetchError && (
            <div role="alert" className="mb-3 flex shrink-0 items-center justify-between rounded-card bg-status-critical-bg p-4 text-status-critical-fg ring-1 ring-status-critical-line">
              <p className="text-sm">{fetchError}</p>
              <Button variant="quiet" size="sm" onClick={loadShops}>再試行</Button>
            </div>
          )}

          {fetchLoading && <CenteredLoading padding="py-16" className="text-nicchyo-ink/40" />}

          {!fetchLoading && !fetchError && (
            <>
              {/* 状態の絞り込み（件数つき）と検索を一行に並べる。PC では一行に収まり、スマホでは検索が次の段に回る */}
              <div className="mb-2 flex shrink-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div role="group" aria-label="状態で絞り込む" className="flex min-w-0 flex-wrap gap-2">
                  {[
                    { key: "all", label: "すべて", count: stats.total },
                    { key: "active", label: "稼働中", count: stats.active },
                    { key: "suspended", label: "停止中", count: stats.suspended },
                  ].map((f) => (
                    <FilterChip key={f.key} active={f.key === filter} onClick={() => setFilter(f.key as typeof filter)}>
                      {f.label}
                      <span className="ml-1 tabular-nums">({f.count})</span>
                    </FilterChip>
                  ))}
                </div>
                <div className="relative w-full shrink-0 lg:w-80">
                  <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-nicchyo-ink/40" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    aria-label="店舗名・オーナーで検索"
                    placeholder="店舗名・オーナーで検索... (/)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-11 w-full rounded-btn border border-line bg-white pl-9 pr-3 text-base text-nicchyo-ink placeholder:text-nicchyo-ink/40 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 sm:h-10 sm:text-sm"
                  />
                </div>
              </div>

              {/* 代表者・QR と カテゴリーの絞り込み */}
              <div className="mb-3 flex shrink-0 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-nicchyo-ink/55">代表者・QR</span>
                  {CLAIM_FILTERS.map((f) => (
                    <FilterChip size="sm" key={f.key} active={claimFilter === f.key} onClick={() => setClaimFilter(f.key)}>
                      {f.label}
                    </FilterChip>
                  ))}
                </div>
                {uniqueCategories.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-nicchyo-ink/55">カテゴリー</span>
                    {["all", ...uniqueCategories].map((cat) => (
                      <FilterChip size="sm" key={cat} active={categoryFilter === cat} onClick={() => setCategoryFilter(cat)}>
                        {cat === "all" ? "すべて" : `${cat} (${categoryStats[cat] ?? 0})`}
                      </FilterChip>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 text-sm text-nicchyo-ink/70 sm:hidden">
                <label className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" checked={selection.allSelected} onChange={selection.toggleAll} disabled={sortedData.length === 0} className="h-5 w-5 accent-amber-600" />
                  表示中をすべて選択
                </label>
                <span aria-live="polite">{sortedData.length}件</span>
                <div className="flex w-full items-center gap-2">
                  <label htmlFor="mobile-shop-sort" className="shrink-0">並び順</label>
                  <select id="mobile-shop-sort" value={sortKey ?? "name"} onChange={(event) => handleSort(event.target.value)} className="h-11 min-w-0 flex-1 rounded-btn border border-line bg-white px-3 text-sm text-nicchyo-ink">
                    {columns.filter((column) => column.sortKey).map((column) => <option key={column.key} value={column.sortKey}>{column.header}</option>)}
                  </select>
                  <Button variant="quiet" className="shrink-0 px-3" onClick={() => handleSort(sortKey ?? "name")} aria-label="並び順を反転">
                    {sortDirection === "asc" ? "昇順 ↑" : "降順 ↓"}
                  </Button>
                </div>
              </div>

              <div className="shrink-0">
                <BulkActionBar count={selection.selectedIds.length} unit="件" onClear={selection.clear}>
                  <Button variant="quiet" size="sm" onClick={handleIssueQr} disabled={issuing || bulkLoading}>
                    {issuing ? "発行しています…" : "QRを発行"}
                  </Button>
                  <Button variant="quiet" size="sm" onClick={() => handleBulk("restore", "復活")} disabled={bulkLoading}>一括復活</Button>
                  <Button variant="quiet" size="sm" onClick={() => handleBulk("suspend", "停止")} disabled={bulkLoading}>一括停止</Button>
                  <Button variant="quiet" size="sm" className={DANGER} onClick={() => handleBulk("delete", "削除")} disabled={bulkLoading}>
                    一括削除
                  </Button>
                </BulkActionBar>
              </div>

              {issueResults && issueResults.some((r) => r.status === "ok") && (
                <div className="mb-3 max-h-[40dvh] shrink overflow-y-auto">
                  <IssuedQrPanel
                    onClose={() => setIssueResults(null)}
                    notice={
                      issueResults.some((r) => r.status !== "ok")
                        ? `発行できなかった店舗: ${issueResults.filter((r) => r.status !== "ok").map((r) => r.shopName ?? r.vendorId).join("、")}`
                        : undefined
                    }
                  >
                    <QrSheet results={issueResults} />
                  </IssuedQrPanel>
                </div>
              )}

              {sortedData.length === 0 ? (
                <EmptyState icon="🏪" title="店舗が見つかりません" description="検索条件に一致する店舗がありません。" />
              ) : (
                <AdminDataTable
                  rows={sortedData}
                  getRowId={(shop) => shop.id}
                  columns={columns}
                  sort={{ key: sortKey, direction: sortDirection, onSort: handleSort }}
                  selection={selection}
                  selectionLabel={(shop) => `${shop.name}を選択`}
                  selectAllLabel="表示中の店舗をすべて選択"
                  virtualize
                  fillHeight
                  actions={(shop) => shopActions(shop)}
                  mobileLayout="list"
                  mobileCard={(shop, index) => (
                    <div className="flex items-start gap-2 px-3 py-3">
                      <label className="flex h-11 w-11 shrink-0 items-center justify-center">
                        <input
                          type="checkbox"
                          aria-label={`${shop.name}を選択`}
                          checked={selection.isSelected(shop.id)}
                          onChange={() => selection.toggle(shop.id, index)}
                          className="h-5 w-5 accent-amber-600"
                        />
                      </label>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link href={`/admin/shops/${shop.id}`} className="break-words font-semibold text-nicchyo-ink hover:underline">
                              {shop.name}
                            </Link>
                            <p className="break-all text-sm text-nicchyo-ink/55">{shop.email}</p>
                          </div>
                          <StatusBadge status={shop.status} />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="text-xs text-nicchyo-ink/70">{shop.category}</span>
                          <ListingStatusBadge status={shop.listingStatus} />
                          {claimStates.has(shop.id) && <ClaimStateBadge state={claimStates.get(shop.id)!} />}
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                          <div><dt className="text-nicchyo-ink/55">オーナー</dt><dd className="mt-0.5 break-words text-nicchyo-ink">{shop.owner}</dd></div>
                          <div><dt className="text-nicchyo-ink/55">登録日</dt><dd className="mt-0.5 break-words text-nicchyo-ink">{shop.registeredDate}</dd></div>
                        </dl>
                        <div className="mt-3 flex flex-wrap gap-2">{shopActions(shop, "md")}</div>
                      </div>
                    </div>
                  )}
                />
              )}
            </>
          )}
        </div>
      </div>

      <ShortcutHelpLauncher shortcuts={shortcuts} open={showShortcutHelp} onOpenChange={setShowShortcutHelp} />
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
