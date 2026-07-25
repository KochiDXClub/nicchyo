"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NavigationBar from "@/app/components/NavigationBar";
import { useAuth } from "@/lib/auth/AuthContext";
import { fetchVendorPosts, repostContent } from "../_services/postsService";
import type { Post, PostStatus } from "../_types";
import {
  ArrowLeft, RotateCcw, Pencil, Clock, CheckCircle2,
  XCircle, PlusCircle, Image as ImageIcon, Loader2, Heart,
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
            {typeof post.heartCount === "number" && (
              <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600">
                <Heart size={10} className="fill-current" />
                {post.heartCount}
              </span>
            )}
          </div>
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
    <div className="min-h-screen bg-[#FFFAF0] pb-24">
      <div className="border-b border-amber-100 bg-white/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href="/my-shop" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-600">Post History</p>
            <h1 className="text-xl font-bold text-slate-900">投稿履歴</h1>
          </div>
          <Link href="/vendor/post/new"
            className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-2 text-xs font-semibold text-white shadow transition hover:bg-amber-400"
          >
            <PlusCircle size={14} />新規投稿
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-4">
        <div className="mb-4 rounded-3xl border border-amber-100 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600">Post History</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">投稿履歴</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            文字を大きめにし、再投稿ボタンも押しやすくしています。
          </p>
          <div className="mt-3">
            <Link href="/vendor/post/new" className="inline-flex rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-400">
              新規投稿へ
            </Link>
          </div>
        </div>

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
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-amber-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-400">投稿がありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((post) => (
              <PostCard key={post.id} post={post} onRepost={handleRepost} onEditRepost={handleEditRepost} />
            ))}
          </div>
        )}
      </div>

      {showToast && <RepostSuccessToast onClose={() => setShowToast(false)} />}
      <NavigationBar />
    </div>
  );
}
