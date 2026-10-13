"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader, EmptyState, ReviewCard, ReviewStats, ReviewToolbar } from "@/components/admin";
import { Badge, Button, type BadgeProps } from "@/components/ui";
import { showToast } from "@/lib/admin/toast";
import { Loader2, Trash2, Clock, EyeOff, Eye } from "lucide-react";
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

const STATUS_BADGE: Record<ContentStatus, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  active: { label: "公開中", variant: "amber" },
  hidden: { label: "非表示", variant: "caution" },
  expired: { label: "期限切れ", variant: "neutral" },
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

        <ReviewStats
          items={[
            { label: "総投稿数", value: stats.total },
            { label: "公開中", value: stats.active, tone: "good" },
            { label: "期限切れ", value: stats.expired, tone: "muted" },
            { label: "非表示", value: stats.hidden, tone: "warning" },
          ]}
        />

        <ReviewToolbar
          filters={[
            { key: "all", label: "すべて", count: stats.total },
            { key: "active", label: "公開中", count: stats.active },
            { key: "expired", label: "期限切れ", count: stats.expired },
            { key: "hidden", label: "非表示", count: stats.hidden },
          ]}
          value={filter}
          onChange={setFilter}
          search={{ value: search, onChange: setSearch, placeholder: "店舗名・本文で検索..." }}
        />

        {/* コンテンツ一覧 */}
        {isLoading ? (
          <CenteredLoading padding="py-16" className="text-nicchyo-ink/40" />
        ) : filtered.length === 0 ? (
          <EmptyState icon="📝" title="投稿が見つかりません" description="条件に一致する投稿はありません。" />
        ) : (
          <ul className="space-y-3">
            {filtered.map((c) => (
              <ReviewCard
                key={c.id}
                image={c.image_url}
                badges={
                  <>
                    <Badge>{c.shop_name}</Badge>
                    <Badge variant={STATUS_BADGE[c.status].variant}>{STATUS_BADGE[c.status].label}</Badge>
                  </>
                }
                meta={
                  <>
                    <span className="flex items-center gap-1">
                      <Clock size={11} aria-hidden="true" />
                      投稿: {formatDate(c.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} aria-hidden="true" />
                      期限: {formatDate(c.expires_at)}
                    </span>
                  </>
                }
                actions={
                  <>
                    {/* 非表示/再表示・削除ボタン */}
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => handleToggleHidden(c)}
                      disabled={togglingId === c.id}
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
                    </Button>
                    <Button
                      variant="quiet"
                      size="sm"
                      className="text-rose-700 hover:bg-rose-50"
                      onClick={() => handleDelete(c.id, c.shop_name)}
                      disabled={deletingId === c.id}
                      aria-label="投稿を削除"
                    >
                      {deletingId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      削除
                    </Button>
                  </>
                }
              >
                <p className="line-clamp-2 text-sm text-nicchyo-ink">{c.body ?? "（本文なし）"}</p>
              </ReviewCard>
            ))}
          </ul>
        )}
      </div>
    </AdminLayout>
  );
}
