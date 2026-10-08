"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader, EmptyState } from "@/components/admin";
import { showToast } from "@/lib/admin/toast";
import NextImage from "next/image";
import { Loader2, Trash2, Image as ImageIcon, Clock, Search, EyeOff, Eye } from "lucide-react";
import { CenteredLoading } from "@/components/ui/loading-spinner";
import { computeDisplayStatus, type DbStatus, type DisplayStatus } from "./_helpers";

// 表示用の状態。DB上の status (active/hidden/deleted) と有効期限を組み合わせて算出する
// （算出ロジックは _helpers.ts の computeDisplayStatus に切り出し済み）。
type ContentStatus = DisplayStatus;

type Content = {
  id: string;
  vendor_id: string;
  shop_name: string;
  title: string | null;
  body: string | null;
  image_url: string | null;
  expires_at: string;
  created_at: string;
  status: ContentStatus;
  dbStatus: DbStatus;
};

type DbRow = {
  id: string;
  vendor_id: string;
  title: string | null;
  body: string | null;
  image_url: string | null;
  expires_at: string;
  created_at: string;
  status: DbStatus;
  vendors: { shop_name: string | null } | null;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export default function AdminContentPage() {
  const { permissions, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [contents, setContents] = useState<Content[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ContentStatus>("all");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!permissions.isAdmin) router.push("/");
  }, [authLoading, permissions.isAdmin, router]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/content");
      if (!res.ok) throw new Error(res.statusText);
      const json = await res.json() as { contents: DbRow[] };
      const now = new Date();
      setContents(
        (json.contents ?? []).map((r) => ({
          id: r.id,
          vendor_id: r.vendor_id,
          shop_name: r.vendors?.shop_name ?? "名称未設定",
          title: r.title,
          body: r.body,
          image_url: r.image_url,
          expires_at: r.expires_at,
          created_at: r.created_at,
          dbStatus: r.status,
          status: computeDisplayStatus(r.status, r.expires_at, now),
        }))
      );
    } catch {
      showToast.error("データの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { if (!authLoading && permissions.isAdmin) load(); }, [authLoading, permissions.isAdmin, load]);

  const handleDelete = useCallback(async (id: string, shopName: string) => {
    if (!confirm(`「${shopName}」の投稿を削除しますか？`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/content/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setContents((prev) => prev.filter((c) => c.id !== id));
      showToast.success("投稿を削除しました");
    } catch {
      showToast.error("削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  }, []);

  // 完全削除とは別に、一時的に非表示（hidden）⇔再表示（active）を切り替える
  const handleToggleHidden = useCallback(async (content: Content) => {
    const nextStatus = content.dbStatus === "hidden" ? "active" : "hidden";
    setTogglingId(content.id);
    try {
      const res = await fetch(`/api/admin/content/${content.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error();
      setContents((prev) =>
        prev.map((c) =>
          c.id === content.id
            ? { ...c, dbStatus: nextStatus, status: computeDisplayStatus(nextStatus, c.expires_at) }
            : c
        )
      );
      showToast.success(nextStatus === "hidden" ? "投稿を非表示にしました" : "投稿を再表示しました");
    } catch {
      showToast.error("状態の更新に失敗しました");
    } finally {
      setTogglingId(null);
    }
  }, []);

  const filtered = useMemo(() => {
    return contents.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.shop_name.toLowerCase().includes(q) ||
          (c.body ?? "").toLowerCase().includes(q) ||
          (c.title ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [contents, filter, search]);

  const stats = useMemo(() => ({
    total: contents.length,
    active: contents.filter((c) => c.status === "active").length,
    expired: contents.filter((c) => c.status === "expired").length,
    hidden: contents.filter((c) => c.status === "hidden").length,
  }), [contents]);

  if (authLoading || !permissions.isAdmin) return null;

  return (
    <AdminLayout>
      <AdminPageHeader eyebrow="Content" title="コンテンツ管理" />

      <div className="mx-auto max-w-7xl px-4 py-8 pb-20">

        {/* 統計カード */}
        <div className="mb-6 grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">総投稿数</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">公開中</p>
            <p className="mt-1 text-2xl font-bold text-green-700">{stats.active}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">期限切れ</p>
            <p className="mt-1 text-2xl font-bold text-slate-400">{stats.expired}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">非表示</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{stats.hidden}</p>
          </div>
        </div>

        {/* フィルター・検索 */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex gap-2">
            {(["all", "active", "expired", "hidden"] as const).map((f) => {
              const labels = {
                all: `すべて (${stats.total})`,
                active: `公開中 (${stats.active})`,
                expired: `期限切れ (${stats.expired})`,
                hidden: `非表示 (${stats.hidden})`,
              };
              const activeColors = { all: "bg-gray-700", active: "bg-green-700", expired: "bg-slate-500", hidden: "bg-amber-600" };
              return (
                <button
                  type="button"
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${
                    filter === f
                      ? `${activeColors[f]} text-white`
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="店舗名・本文で検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>

        {/* コンテンツ一覧 */}
        {isLoading ? (
          <CenteredLoading padding="py-16" className="text-slate-400" />
        ) : filtered.length === 0 ? (
          <EmptyState icon="📝" title="投稿が見つかりません" description="条件に一致する投稿はありません。" />
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                {/* サムネイル */}
                {c.image_url ? (
                  <NextImage
                    src={c.image_url}
                    alt=""
                    width={64}
                    height={64}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <ImageIcon size={20} className="text-slate-400" />
                  </div>
                )}

                {/* 本文 */}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      {c.shop_name}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      c.status === "active"
                        ? "bg-green-700 text-white"
                        : c.status === "hidden"
                          ? "bg-amber-600 text-white"
                          : "bg-slate-400 text-white"
                    }`}>
                      {c.status === "active" ? "公開中" : c.status === "hidden" ? "非表示" : "期限切れ"}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-slate-700">{c.body ?? "（本文なし）"}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      投稿: {formatDate(c.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      期限: {formatDate(c.expires_at)}
                    </span>
                  </div>
                </div>

                {/* 非表示/再表示・削除ボタン */}
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleHidden(c)}
                    disabled={togglingId === c.id}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                    aria-label={c.dbStatus === "hidden" ? "投稿を再表示" : "投稿を非表示"}
                  >
                    {togglingId === c.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : c.dbStatus === "hidden" ? (
                      <Eye size={14} />
                    ) : (
                      <EyeOff size={14} />
                    )}
                    {c.dbStatus === "hidden" ? "再表示" : "非表示"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id, c.shop_name)}
                    disabled={deletingId === c.id}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    aria-label="投稿を削除"
                  >
                    {deletingId === c.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
