"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDebounce } from "use-debounce";
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
  ReviewStats,
  ReviewToolbar,
  ShortcutHelpLauncher,
  StatusBadge,
  useRowSelection,
  type DataColumn,
} from "@/components/admin";
import { useBulkAction } from "@/components/admin/useBulkAction";
import { useListExport } from "@/components/admin/useListExport";
import { Button, Surface } from "@/components/ui";
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
      render: (shop) => (
        <>
          <Link href={`/admin/shops/${shop.id}`} className="text-sm font-medium text-nicchyo-ink hover:underline">
            {shop.name}
          </Link>
          <div className="text-xs text-nicchyo-ink/55">{shop.email}</div>
        </>
      ),
    },
    { key: "category", header: "カテゴリー", sortKey: "category", render: (shop) => shop.category },
    { key: "owner", header: "オーナー", sortKey: "owner", render: (shop) => shop.owner },
    {
      key: "status",
      header: "ステータス",
      sortKey: "status",
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
      render: (shop) =>
        claimStates.has(shop.id) ? (
          <ClaimStateBadge state={claimStates.get(shop.id)!} />
        ) : (
          <span className="text-xs text-nicchyo-ink/40">-</span>
        ),
    },
    { key: "registeredDate", header: "登録日", sortKey: "registeredDate", className: "whitespace-nowrap", render: (shop) => shop.registeredDate },
  ];

  const shopActions = (shop: AdminShop, className?: string) => (
    <>
      {shop.status === "active" ? (
        <Button variant="quiet" size="sm" className={className} onClick={() => runSingle("suspend", shop.id, "停止")}>停止</Button>
      ) : (
        <Button variant="quiet" size="sm" className={className} onClick={() => runSingle("restore", shop.id, "復活")}>復活</Button>
      )}
      <Button variant="quiet" size="sm" className={`${DANGER} ${className ?? ""}`} onClick={() => runSingle("delete", shop.id, "削除")}>
        削除
      </Button>
    </>
  );

  if (isLoading || !permissions.isAdmin) {
    return null;
  }

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="Shops"
        title="店舗管理"
        actions={<ExportActions onCsv={exportCsv} onJson={exportJson} loading={isExporting} />}
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
            >
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <span className="text-xs font-medium text-nicchyo-ink/55">代表者・QR</span>
                {CLAIM_FILTERS.map((f) => (
                  <FilterChip size="sm" key={f.key} active={claimFilter === f.key} onClick={() => setClaimFilter(f.key)}>
                    {f.label}
                  </FilterChip>
                ))}
              </div>
              {uniqueCategories.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <span className="text-xs font-medium text-nicchyo-ink/55">カテゴリー</span>
                  {["all", ...uniqueCategories].map((cat) => (
                    <FilterChip size="sm" key={cat} active={categoryFilter === cat} onClick={() => setCategoryFilter(cat)}>
                      {cat === "all" ? "すべて" : `${cat} (${categoryStats[cat] ?? 0})`}
                    </FilterChip>
                  ))}
                </div>
              )}
            </ReviewToolbar>

            <BulkActionBar count={selection.selectedIds.length} onClear={selection.clear}>
              <Button variant="quiet" size="sm" onClick={handleIssueQr} disabled={issuing || bulkLoading}>
                {issuing ? "発行しています…" : "QRを発行"}
              </Button>
              <Button variant="quiet" size="sm" onClick={() => handleBulk("restore", "復活")} disabled={bulkLoading}>一括復活</Button>
              <Button variant="quiet" size="sm" onClick={() => handleBulk("suspend", "停止")} disabled={bulkLoading}>一括停止</Button>
              <Button variant="quiet" size="sm" className={DANGER} onClick={() => handleBulk("delete", "削除")} disabled={bulkLoading}>
                一括削除
              </Button>
            </BulkActionBar>

            {issueResults && issueResults.some((r) => r.status === "ok") && (
              <div className="mb-4">
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
                actions={(shop) => shopActions(shop)}
                mobileCard={(shop) => (
                  <Surface padding="sm">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          aria-label={`${shop.name}を選択`}
                          checked={selection.isSelected(shop.id)}
                          onChange={() => selection.toggle(shop.id, 0)}
                          className="mt-1 h-4 w-4 rounded border-line accent-amber-600"
                        />
                        <div>
                          <Link href={`/admin/shops/${shop.id}`} className="font-medium text-nicchyo-ink hover:underline">
                            {shop.name}
                          </Link>
                          <div className="text-xs text-nicchyo-ink/55">{shop.category}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <ListingStatusBadge status={shop.listingStatus} />
                            {claimStates.has(shop.id) && <ClaimStateBadge state={claimStates.get(shop.id)!} />}
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={shop.status} />
                    </div>
                    <div className="mb-3 text-xs text-nicchyo-ink/55">
                      オーナー: {shop.owner}<span className="mx-2">·</span>登録: {shop.registeredDate}
                    </div>
                    <div className="flex gap-2">{shopActions(shop, "flex-1")}</div>
                  </Surface>
                )}
              />
            )}
          </>
        )}
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
