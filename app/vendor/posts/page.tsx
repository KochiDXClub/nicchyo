"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { CenteredLoading, EmptyMessage, PageContainer, PageShell, PageTitle, Surface, buttonClass } from "@/components/ui";
import { sumPostStats } from "@/lib/story/postStats";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { fetchVendorPosts, repostContent } from "../_services/postsService";
import type { Post, PostStatus } from "../_types";
import {
  RotateCcw, Pencil, Clock, CheckCircle2,
  XCircle, PlusCircle, Image as ImageIcon, Heart, Eye,
} from "lucide-react";

type FilterTab = "all" | "active" | "expired";

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}日前`;
  if (h > 0) return `${h}時間前`;
  if (m > 0) return `${m}分前`;
  return "たった今";
}

function StatusBadge({ status }: { status: PostStatus }) {
  if (status === "active") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
        <CheckCircle2 size={10} />公開中
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
      <XCircle size={10} />期限切れ
    </span>
  );
}

function PostCard({ post, onRepost, onEditRepost }: { post: Post; onRepost: (post: Post) => void; onEditRepost: (post: Post) => void }) {
  return (
    <div className={`rounded-3xl border bg-white p-4 shadow-sm transition ${post.status === "active" ? "border-amber-100" : "border-slate-200"}`}>
      <div className="flex items-start gap-3">
        {post.image_url ? (
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100" style={{ backgroundImage: `url(${post.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        ) : (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-300">
            <ImageIcon size={20} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-3 text-sm leading-relaxed text-slate-800">{post.text}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={post.status} />
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <Clock size={10} />{timeAgo(post.created_at)}
            </span>
          </div>
          <PostStatsRow post={post} />
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
        <button type="button" onClick={() => onRepost(post)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-amber-200 bg-amber-50 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
        >
          <RotateCcw size={13} />そのまま再投稿
        </button>
        <button type="button" onClick={() => onEditRepost(post)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          <Pencil size={13} />編集して再投稿
        </button>
      </div>
    </div>
  );
}

/** 近況ごとの「見た人」「ハート」。数を読めなかったときは出さない */
function PostStatsRow({ post }: { post: Post }) {
  if (typeof post.viewCount !== "number" && typeof post.heartCount !== "number") return null;
  return (
    <dl className="mt-2 flex items-center gap-4 text-sm">
      {typeof post.viewCount === "number" && (
        <div className="flex items-center gap-1.5 text-nicchyo-ink/70">
          <dt className="flex items-center gap-1">
            <Eye size={15} aria-hidden="true" />
            見た人
          </dt>
          <dd className="font-bold tabular-nums text-nicchyo-ink">{post.viewCount}</dd>
        </div>
      )}
      {typeof post.heartCount === "number" && (
        <div className="flex items-center gap-1.5 text-rose-600">
          <dt className="flex items-center gap-1">
            <Heart size={15} className="fill-current" aria-hidden="true" />
            <span className="sr-only">ハート</span>
          </dt>
          <dd className="font-bold tabular-nums">{post.heartCount}</dd>
        </div>
      )}
    </dl>
  );
}

/** 公開中の近況が、いまどれくらい見られているか */
function ActiveSummary({ posts }: { posts: Post[] }) {
  const active = posts.filter((post) => post.status === "active");
  if (posts.every((post) => typeof post.viewCount !== "number")) return null;
  const total = sumPostStats(active.map((post) => ({ views: post.viewCount ?? 0, hearts: post.heartCount ?? 0 })));
  return (
    <Surface className="mb-4">
      <h2 className="text-sm font-bold text-nicchyo-ink/70">公開中の近況（{active.length}件）</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-btn bg-nicchyo-base px-4 py-3">
          <dt className="flex items-center gap-1.5 text-sm text-nicchyo-ink/70">
            <Eye size={16} aria-hidden="true" />
            見た人
          </dt>
          <dd className="mt-1 text-3xl font-bold tabular-nums text-nicchyo-ink">{total.views}</dd>
        </div>
        <div className="rounded-btn bg-rose-50 px-4 py-3">
          <dt className="flex items-center gap-1.5 text-sm text-rose-700">
            <Heart size={16} className="fill-current" aria-hidden="true" />
            ハート
          </dt>
          <dd className="mt-1 text-3xl font-bold tabular-nums text-rose-700">{total.hearts}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-nicchyo-ink/55">
        見た人は、1人が何度見ても1人と数えます。自分で開いた分は数えません。
      </p>
    </Surface>
  );
}

function RepostSuccessToast({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 transform">
      <div className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 shadow-lg">
        <CheckCircle2 size={16} className="text-white" />
        <span className="text-sm font-semibold text-white">再投稿しました！</span>
        <button type="button" onClick={onClose} className="ml-2 text-emerald-200 hover:text-white"><XCircle size={14} /></button>
      </div>
    </div>
  );
}

export default function VendorPostsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [posts, setPosts]         = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchVendorPosts(user.id)
      .then(setPosts)
      .catch(() => setError("投稿の読み込みに失敗しました"))
      .finally(() => setIsLoading(false));
  }, [user]);

  const filtered = activeTab === "all" ? posts : posts.filter((p) => p.status === activeTab);

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: "all",     label: "すべて",  count: posts.length },
    { key: "active",  label: "公開中",  count: posts.filter((p) => p.status === "active").length },
    { key: "expired", label: "期限切れ",count: posts.filter((p) => p.status === "expired").length },
  ];

  async function handleRepost(post: Post) {
    if (!user) return;
    try {
      const newPost = await repostContent(user.id, post);
      setPosts((prev) => [newPost, ...prev]);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch {
      setError("再投稿に失敗しました");
    }
  }

  function handleEditRepost(post: Post) {
    router.push(`/vendor/post/new?repost=${post.id}`);
  }

  return (
    <PageShell bottomNav={false}>
      <PageTitle
        title="投稿履歴"
        action={<Link href="/vendor/post/new" className={buttonClass({ size: "sm" })}><PlusCircle size={14} aria-hidden="true" />新規投稿</Link>}
      />

      <PageContainer>
        {!isLoading && <ActiveSummary posts={posts} />}

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        <div className="mb-4 flex gap-1.5 rounded-3xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {TABS.map((tab) => (
            <button type="button" key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-semibold transition ${activeTab === tab.key ? "bg-amber-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {tab.label}
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${activeTab === tab.key ? "bg-amber-400 text-white" : "bg-slate-100 text-slate-400"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <CenteredLoading />
        ) : filtered.length === 0 ? (
          <EmptyMessage message="投稿がありません" padding="py-12" />
        ) : (
          <div className="space-y-3">
            {filtered.map((post) => (
              <PostCard key={post.id} post={post} onRepost={handleRepost} onEditRepost={handleEditRepost} />
            ))}
          </div>
        )}
      </PageContainer>

      {showToast && <RepostSuccessToast onClose={() => setShowToast(false)} />}
    </PageShell>
  );
}
