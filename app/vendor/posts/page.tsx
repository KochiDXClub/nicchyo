"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { CenteredLoading, EmptyMessage, PageContainer, PageShell, PageTitle, Surface } from "@/components/ui";
import { sumPostStats } from "@/lib/story/postStats";
import { useAuth } from "@/lib/auth/AuthContext";
import { canDecodeImage, imageErrorMessage, IMAGE_DECODE_ERROR_MESSAGE } from "@/lib/image/clientCompression";
import { createPost, fetchPostIdentity, fetchVendorPosts, repostContent } from "../_services/postsService";
import type { ExpirationPreset, Post, PostStatus } from "../_types";
import {
  RotateCcw, Pencil, Clock, CheckCircle2,
  XCircle, Image as ImageIcon, Heart, Eye,
} from "lucide-react";
import { calcExpiresAt, formatExpiresAt } from "./expiration";
import PhotoPicker from "./components/PhotoPicker";
import StoryComposer from "./components/StoryComposer";
import PostDone from "./components/PostDone";

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
          {/* 写真だけの投稿（ひとこと無し）は空の段落を出さず、見分けられる文言にする */}
          <p className={`line-clamp-3 text-sm leading-relaxed ${post.text ? "text-slate-800" : "text-slate-400"}`}>
            {post.text || "写真だけの投稿"}
          </p>
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

/**
 * 近況の出し方と履歴を1ページにまとめた画面。
 * 先頭で写真を選んで出し、その下で出した近況を見返す・出し直す。
 * 写真を選んだら書く画面（StoryComposer）に切り替わり、出し終えると一覧に戻る。
 */
export default function VendorPostsPage() {
  const { user } = useAuth();
  // 店舗の ID はアカウントの ID（user.id）とは別。必ず所属店舗の ID を使う
  const vendorId = user?.vendorId;

  // ── 履歴 ──
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [posts, setPosts]         = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // ── 近況を出す ──
  const [identity, setIdentity] = useState<{ shopName: string | null; shopImageUrl: string | null }>({
    shopName: null,
    shopImageUrl: null,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  /** 前の投稿をもとに出し直すときの、すでに保存されている写真 */
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [preset, setPreset] = useState<ExpirationPreset>("sunday");
  const [customDateTime, setCustomDateTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; imageUrl: string; label: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!vendorId) return;
    fetchVendorPosts(vendorId)
      .then(setPosts)
      .catch(() => setError("投稿の読み込みに失敗しました"))
      .finally(() => setIsLoading(false));
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return;
    let cancelled = false;
    fetchPostIdentity(vendorId)
      .then((loaded) => {
        if (!cancelled) setIdentity(loaded);
      })
      .catch((err: unknown) => {
        // 名札が出せなくても投稿はできる。原因は追えるようにしておく
        console.warn("[VendorPostsPage] お店の名札を読めませんでした", err);
      });
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  // 端末の写真を見せるための一時 URL は、差し替えたら手放す
  useEffect(() => {
    if (!imagePreview?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const expiresAt = useMemo(() => calcExpiresAt(preset, customDateTime), [preset, customDateTime]);

  const filtered = activeTab === "all" ? posts : posts.filter((p) => p.status === activeTab);

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: "all",     label: "すべて",  count: posts.length },
    { key: "active",  label: "公開中",  count: posts.filter((p) => p.status === "active").length },
    { key: "expired", label: "期限切れ",count: posts.filter((p) => p.status === "expired").length },
  ];

  async function handlePick(file: File) {
    // 送るときの変換でつまずく前に、このブラウザで読める写真かを確かめる
    if (!(await canDecodeImage(file))) {
      setComposeError(IMAGE_DECODE_ERROR_MESSAGE);
      return;
    }
    setComposeError(null);
    setImageFile(file);
    setExistingImageUrl(null);
    setImagePreview(URL.createObjectURL(file));
  }

  function discardPhoto() {
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
    setComposeError(null);
  }

  function resetComposer() {
    discardPhoto();
    setText("");
    setPreset("sunday");
    setCustomDateTime("");
  }

  async function handleSubmit() {
    if (!vendorId || submitting) return;
    if (!imageFile && !existingImageUrl) return;
    const at = calcExpiresAt(preset, customDateTime);
    if (!at) {
      setComposeError("いつまで出すかを、これから先の日時で選んでください");
      return;
    }
    setSubmitting(true);
    setComposeError(null);
    try {
      const post = await createPost(vendorId, text.trim(), at, imageFile ?? undefined, existingImageUrl ?? undefined);
      setDone({ id: post.id, imageUrl: post.image_url ?? imagePreview ?? "", label: formatExpiresAt(preset, at) });
      // 出した近況を、戻ったときの一覧にすぐ出す
      setPosts((prev) => [{ ...post, viewCount: 0, heartCount: 0 }, ...prev]);
    } catch (err) {
      setComposeError(imageErrorMessage(err, "うまく出せませんでした。もう一度お試しください。"));
    } finally {
      setSubmitting(false);
    }
  }

  function backToList() {
    resetComposer();
    setDone(null);
  }

  async function handleRepost(post: Post) {
    if (!vendorId) return;
    try {
      const newPost = await repostContent(vendorId, post);
      setPosts((prev) => [newPost, ...prev]);
      setShowToast(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setShowToast(false), 3000);
    } catch {
      setError("再投稿に失敗しました");
    }
  }

  /** 前の投稿の写真とひとことで、書く画面を開く */
  function handleEditRepost(post: Post) {
    resetComposer();
    setText(post.text);
    if (post.image_url) {
      setImagePreview(post.image_url);
      setExistingImageUrl(post.image_url);
    }
    window.scrollTo({ top: 0 });
  }

  const composing = imagePreview !== null;
  const width = done || composing ? "narrow" : "reading";

  return (
    <PageShell bottomNav={false}>
      <PageTitle title={done ? "出しました" : composing ? "近況を出す" : "近況"} width={width} />

      <PageContainer width={width}>
        {done ? (
          <PostDone
            postId={done.id}
            imageUrl={done.imageUrl}
            expiresLabel={done.label}
            onAnother={backToList}
            onBack={backToList}
          />
        ) : composing ? (
          <StoryComposer
            imageUrl={imagePreview}
            shopName={identity.shopName ?? user?.name ?? "あなたのお店"}
            shopImageUrl={identity.shopImageUrl}
            text={text}
            onTextChange={setText}
            preset={preset}
            onPresetChange={setPreset}
            customDateTime={customDateTime}
            onCustomDateTimeChange={setCustomDateTime}
            expiresAt={expiresAt}
            submitting={submitting}
            error={composeError}
            onDiscard={discardPhoto}
            onSubmit={handleSubmit}
          />
        ) : (
          <>
            {composeError && (
              <p role="alert" className="mb-4 flex items-start gap-2 rounded-btn bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                {composeError}
              </p>
            )}
            <div className="mb-8">
              <PhotoPicker onPick={handlePick} />
            </div>

            {!isLoading && <ActiveSummary posts={posts} />}

            {error && (
              <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            )}

            <h2 className="mb-3 text-sm font-bold text-nicchyo-ink/70">これまでの近況・もう一度出す</h2>
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
          </>
        )}
      </PageContainer>

      {showToast && <RepostSuccessToast onClose={() => setShowToast(false)} />}
    </PageShell>
  );
}
