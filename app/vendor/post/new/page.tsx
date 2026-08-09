"use client";

export const dynamic = "force-dynamic";

import { useState, useRef, useEffect, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { createPost, fetchVendorPosts, fetchPostById, repostContent } from "../../_services/postsService";
import type { ExpirationPreset, Post, PostStatus } from "../../_types";
import { getNextSundayExpiry } from "@/lib/utils/date";
import {
  ArrowLeft,
  Image as ImageIcon,
  Clock,
  Calendar,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Pencil,
  XCircle,
  PlusCircle,
  Heart,
} from "lucide-react";
import { CenteredLoading } from "@/components/ui/loading-spinner";
import { EmptyMessage } from "@/components/ui/empty-message";

type ActiveTab = "new" | "history";
type FilterTab = "all" | "active" | "expired";

// ── 投稿履歴用ユーティリティ ──────────────────────────────

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
    <div className={`rounded-2xl border bg-white p-4 shadow-sm transition ${post.status === "active" ? "border-amber-100" : "border-slate-200"}`}>
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
      <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
        <button type="button" onClick={() => onRepost(post)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
        >
          <RotateCcw size={13} />そのまま再投稿
        </button>
        <button type="button" onClick={() => onEditRepost(post)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          <Pencil size={13} />編集して再投稿
        </button>
      </div>
    </div>
  );
}

// ── 新規投稿用ユーティリティ ──────────────────────────────

type ExpirationOption = { preset: ExpirationPreset; label: string; desc: string; icon: typeof Clock };

const EXPIRATION_OPTIONS: ExpirationOption[] = [
  { preset: "1h",     label: "1時間",       desc: "今すぐ来てほしい情報に",   icon: Clock },
  { preset: "sunday", label: "今週の日曜まで", desc: "近況として日曜にリセット", icon: Calendar },
  { preset: "custom", label: "カスタム",     desc: "時間を自分で設定",         icon: Clock },
];

function calcExpirationTime(preset: ExpirationPreset, customDateTime: string): Date {
  const now = new Date();
  if (preset === "1h") return new Date(now.getTime() + 60 * 60 * 1000);
  if (preset === "sunday") return getNextSundayExpiry();
  return customDateTime ? new Date(customDateTime) : new Date(now.getTime() + 2 * 60 * 60 * 1000);
}

function formatExpirationLabel(preset: ExpirationPreset, customDateTime: string): string {
  const exp = calcExpirationTime(preset, customDateTime);
  if (preset === "1h") return "あと1時間";
  if (preset === "sunday") {
    const m = exp.getMonth() + 1;
    const d = exp.getDate();
    return `${m}/${d}（日）まで`;
  }
  const h = exp.getHours().toString().padStart(2, "0");
  const mn = exp.getMinutes().toString().padStart(2, "0");
  return `${h}:${mn}まで`;
}

// ── メインコンポーネント ──────────────────────────────────

export default function VendorPostNewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>("new");

  // 新規投稿フォームの状態
  const [text, setText]                         = useState("");
  const [imageFile, setImageFile]               = useState<File | null>(null);
  const [imagePreview, setImagePreview]         = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [expirationPreset, setExpirationPreset] = useState<ExpirationPreset>("sunday");
  const [customDateTime, setCustomDateTime]     = useState("");
  const [isSubmitting, setIsSubmitting]         = useState(false);
  const [isSubmitted, setIsSubmitted]           = useState(false);
  const [showPreview, setShowPreview]           = useState(false);
  const [formError, setFormError]               = useState<string | null>(null);
  const [isRepost, setIsRepost]                 = useState(false);

  // 投稿履歴の状態
  const [filterTab, setFilterTab]   = useState<FilterTab>("all");
  const [posts, setPosts]           = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [historyLoaded, setHistoryLoaded]   = useState(false);
  const [historyError, setHistoryError]     = useState<string | null>(null);
  const [showRepostToast, setShowRepostToast] = useState(false);

  // 編集再投稿：URLの ?repost=ID から投稿内容を事前入力
  useEffect(() => {
    const repostId = searchParams.get("repost");
    if (!repostId) return;
    fetchPostById(repostId).then((post) => {
      if (!post) return;
      setText(post.text);
      if (post.image_url) {
        setImagePreview(post.image_url);
        setExistingImageUrl(post.image_url);
      }
      setIsRepost(true);
      setActiveTab("new");
    });
  }, [searchParams]);

  // 投稿履歴タブに切り替えたときに一度だけ取得
  useEffect(() => {
    if (activeTab !== "history" || historyLoaded || !user) return;
    setIsLoadingPosts(true);
    fetchVendorPosts(user.id)
      .then(setPosts)
      .catch(() => setHistoryError("投稿の読み込みに失敗しました"))
      .finally(() => { setIsLoadingPosts(false); setHistoryLoaded(true); });
  }, [activeTab, historyLoaded, user]);

  const filtered = filterTab === "all" ? posts : posts.filter((p) => p.status === filterTab);

  const FILTER_TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: "all",     label: "すべて",   count: posts.length },
    { key: "active",  label: "公開中",   count: posts.filter((p) => p.status === "active").length },
    { key: "expired", label: "期限切れ", count: posts.filter((p) => p.status === "expired").length },
  ];

  async function handleRepost(post: Post) {
    if (!user) return;
    try {
      const newPost = await repostContent(user.id, post);
      setPosts((prev) => [newPost, ...prev]);
      setShowRepostToast(true);
      setTimeout(() => setShowRepostToast(false), 3000);
    } catch {
      setHistoryError("再投稿に失敗しました");
    }
  }

  function handleEditRepost(post: Post) {
    router.push(`/vendor/post/new?repost=${post.id}`);
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setExistingImageUrl(null);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleRemoveImage() {
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || isSubmitting || !user) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const expiresAt = calcExpirationTime(expirationPreset, customDateTime);
      await createPost(user.id, text, expiresAt, imageFile ?? undefined, existingImageUrl ?? undefined);
      setIsSubmitted(true);
      setHistoryLoaded(false); // 次回履歴タブ開時に再取得
    } catch {
      setFormError("投稿に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  const MAX_CHARS = 300;
  const isValid = text.trim().length > 0;

  // 投稿完了画面
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#FFFAF0] pb-24">
        <div className="mx-auto max-w-2xl px-4 pt-16 text-center">
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 size={40} className="text-emerald-600" />
            </div>
          </div>
          <h2 className="mt-6 text-2xl font-bold text-slate-900">投稿しました！</h2>
          <p className="mt-2 text-sm text-slate-500">
            {formatExpirationLabel(expirationPreset, customDateTime)}の間、マップ上に表示されます
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link href="/my-shop" className="rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-amber-400">
              出店者メニューへ
            </Link>
            <button
              type="button"
              onClick={() => { setIsSubmitted(false); setText(""); setImageFile(null); setImagePreview(null); setExpirationPreset("sunday"); setCustomDateTime(""); }}
              className="text-sm font-medium text-slate-500 hover:text-slate-700 hover:underline"
            >
              続けて投稿する
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFAF0] pb-24">
      {/* ヘッダー */}
      <div className="border-b border-amber-100 bg-white/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href="/my-shop" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-600">Post</p>
            <h1 className="text-xl font-bold text-slate-900">最新情報の発信</h1>
          </div>
        </div>

        {/* タブバー */}
        <div className="mx-auto mt-3 flex max-w-2xl gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("new")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold transition ${activeTab === "new" ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <PlusCircle size={13} />新規投稿
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold transition ${activeTab === "history" ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <Clock size={13} />投稿履歴
          </button>
        </div>
      </div>

      {/* 新規投稿フォーム */}
      {activeTab === "new" && (
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4 px-4 pt-5">
          <div className="rounded-3xl border border-amber-100 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600">投稿のポイント</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
              <li>・今日伝えたいことを1つに絞る</li>
              <li>・画像があると見つけてもらいやすい</li>
              <li>・表示期間は短めにすると新鮮さが伝わる</li>
            </ul>
          </div>

          {isRepost && (
            <div className="flex items-center gap-2 rounded-3xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <Pencil size={14} />過去の投稿を編集して再投稿します
            </div>
          )}
          {formError && (
            <div className="flex items-center gap-2 rounded-3xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertCircle size={14} />{formError}
            </div>
          )}

          {/* テキスト入力 */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="px-4 pt-4">
              <label className="mb-2 block text-sm font-semibold uppercase tracking-wider text-slate-400">投稿内容</label>
              <textarea
                value={text} onChange={(e) => setText(e.target.value)}
                placeholder="今日のおすすめ情報・残り数量・特別メニューなど..."
                maxLength={MAX_CHARS} rows={6}
                className="w-full resize-none rounded-2xl bg-slate-50 px-4 py-4 text-base text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
            <div className="flex items-center justify-between px-4 pb-3">
              <span className={`text-sm ${text.length > MAX_CHARS * 0.9 ? "text-red-500" : "text-slate-400"}`}>
                {text.length} / {MAX_CHARS}
              </span>
              {text.length === 0 && (
                <span className="flex items-center gap-1 text-sm text-slate-400">
                  <AlertCircle size={11} />テキストを入力してください
                </span>
              )}
            </div>
          </div>

          {/* 画像アップロード */}
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="mb-3 block text-sm font-semibold uppercase tracking-wider text-slate-400">画像（任意）</label>
            {imagePreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="プレビュー" className="h-48 w-full rounded-xl object-cover" />
                <button type="button" onClick={handleRemoveImage}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-500"
              >
                <ImageIcon size={24} />
                <span className="text-base font-medium">タップして画像を追加</span>
                <span className="text-sm text-slate-400">JPG / PNG / WEBP（5MB以内）</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>

          {/* 表示期間 */}
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="mb-3 block text-sm font-semibold uppercase tracking-wider text-slate-400">表示期間</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {EXPIRATION_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = expirationPreset === opt.preset;
                return (
                  <button key={opt.preset} type="button" onClick={() => setExpirationPreset(opt.preset)}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-4 text-center transition ${isSelected ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50/50"}`}
                  >
                    <Icon size={20} />
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span className="text-xs leading-tight text-slate-400">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
            {expirationPreset === "custom" && (
              <div className="mt-3">
                <label className="mb-1.5 block text-sm text-slate-500">終了日時を選択</label>
                <input type="datetime-local" value={customDateTime} onChange={(e) => setCustomDateTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-base text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>
            )}
            {(expirationPreset !== "custom" || customDateTime) && (
              <div className="mt-3 flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-3">
                <Clock size={14} className="text-amber-600" />
                <span className="text-sm text-amber-700">
                  表示ラベル：<span className="font-semibold">「{formatExpirationLabel(expirationPreset, customDateTime)}」</span>
                </span>
              </div>
            )}
          </div>

          {/* プレビュー */}
          {text.trim().length > 0 && (
            <div>
              <button type="button" onClick={() => setShowPreview(!showPreview)}
                className="mb-2 text-base font-semibold text-amber-600 hover:underline"
              >
                {showPreview ? "プレビューを閉じる" : "投稿プレビューを確認"}
              </button>
              {showPreview && (
                <div className="rounded-3xl border border-amber-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">出</div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">あなたの店舗</p>
                      <p className="text-xs text-slate-400">{formatExpirationLabel(expirationPreset, customDateTime)}</p>
                    </div>
                    <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">公開中</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-base text-slate-800">{text}</p>
                  {imagePreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imagePreview} alt="投稿画像" className="mt-3 w-full rounded-xl object-cover" style={{ maxHeight: "200px" }} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* 送信ボタン */}
          <button type="submit" disabled={!isValid || isSubmitting}
            className={`flex w-full items-center justify-center gap-2 rounded-3xl py-4 text-base font-bold shadow transition ${
              isValid && !isSubmitting ? "bg-amber-500 text-white hover:bg-amber-400" : "cursor-not-allowed bg-slate-200 text-slate-400"
            }`}
          >
            {isSubmitting ? <><Loader2 size={18} className="animate-spin" />投稿中...</> : <><Send size={18} />投稿する</>}
          </button>
        </form>
      )}

      {/* 投稿履歴 */}
      {activeTab === "history" && (
        <div className="mx-auto max-w-2xl px-4 pt-4">
          {historyError && (
            <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{historyError}</div>
          )}

          <div className="mb-4 flex gap-1.5 rounded-3xl border border-slate-200 bg-white p-1.5 shadow-sm">
            {FILTER_TABS.map((tab) => (
              <button type="button" key={tab.key} onClick={() => setFilterTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-semibold transition ${filterTab === tab.key ? "bg-amber-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${filterTab === tab.key ? "bg-amber-400 text-white" : "bg-slate-100 text-slate-400"}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {isLoadingPosts ? (
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
        </div>
      )}

      {/* 再投稿トースト */}
      {showRepostToast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 transform">
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 shadow-lg">
            <CheckCircle2 size={16} className="text-white" />
            <span className="text-sm font-semibold text-white">再投稿しました！</span>
            <button type="button" onClick={() => setShowRepostToast(false)} className="ml-2 text-emerald-200 hover:text-white">
              <XCircle size={14} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
