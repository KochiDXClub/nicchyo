"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useRouter } from "next/navigation";
import type { BannerTheme, ActivePostItem } from "./ShopBannerHero";
import { fetchReactionCounts, toggleReaction, type ReactionState } from "@/lib/story/reactions";
import { getOrCreateConsultVisitorKey } from "@/lib/consultVisitorKey";

/**
 * 投稿ごとのハートボタン（ストーリービューアと同じ匿名トグルを再利用）。
 * 状態が読み込めるまでは押せない・件数はちらつき防止のため常時表示。
 */
function PostHeartButton({
  state,
  onToggle,
}: {
  state: ReactionState | undefined;
  onToggle: () => void;
}) {
  const reacted = state?.reacted ?? false;
  return (
    <button
      type="button"
      disabled={!state}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="-ml-2 flex items-center gap-1 rounded-full px-2 py-1 transition-transform active:scale-90 disabled:opacity-40"
      aria-label={reacted ? "ハートを外す" : "ハートを送る"}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={reacted ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={reacted ? "text-rose-500" : "text-slate-400"}
        aria-hidden
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      <span
        className={`text-xs tabular-nums ${reacted ? "font-bold text-rose-500" : "text-slate-400"}`}
      >
        {state?.count ?? 0}
      </span>
    </button>
  );
}

export function PostCarousel({
  activePosts,
  theme,
  currentPostIndex,
  isActivePostCentered,
  activePostRef,
  activePostCarouselRef,
}: {
  activePosts: ActivePostItem[];
  theme: BannerTheme;
  currentPostIndex: number;
  isActivePostCentered: boolean;
  activePostRef: RefObject<HTMLDivElement>;
  activePostCarouselRef: RefObject<HTMLDivElement>;
}) {
  const router = useRouter();
  // vendor_contents の id ごとのハート状態（id を持つ投稿のみ対象）
  const [reactions, setReactions] = useState<Record<string, ReactionState>>({});
  const visitorKeyRef = useRef<string | null>(null);

  // ストーリー一覧は画像つき投稿のみ載るため、画像がある投稿だけ遷移できる
  const openStory = (post: ActivePostItem) => {
    if (!post.id || !post.imageUrl) return;
    router.push(`/story?content=${encodeURIComponent(post.id)}`);
  };

  const postIdsKey = activePosts
    .map((post) => post.id)
    .filter(Boolean)
    .join(",");

  useEffect(() => {
    const ids = postIdsKey ? postIdsKey.split(",") : [];
    if (ids.length === 0) return;
    let cancelled = false;
    const visitorKey = getOrCreateConsultVisitorKey();
    visitorKeyRef.current = visitorKey;
    fetchReactionCounts(ids, visitorKey ?? undefined)
      .then(({ counts, reactedIds }) => {
        if (cancelled) return;
        const reactedSet = new Set(reactedIds);
        const next: Record<string, ReactionState> = {};
        ids.forEach((id) => {
          next[id] = { count: counts[id] ?? 0, reacted: reactedSet.has(id) };
        });
        setReactions(next);
      })
      .catch(() => {
        // 取得失敗時はハートを出さない（disabled のまま）
      });
    return () => {
      cancelled = true;
    };
  }, [postIdsKey]);

  const handleToggle = async (contentId: string) => {
    const visitorKey = visitorKeyRef.current ?? getOrCreateConsultVisitorKey();
    if (!visitorKey) return;
    const prev = reactions[contentId];
    if (!prev) return;
    // 楽観更新 → 失敗時は元に戻す（StoryViewer と同じ方針）
    setReactions((s) => ({
      ...s,
      [contentId]: {
        count: Math.max(0, prev.count + (prev.reacted ? -1 : 1)),
        reacted: !prev.reacted,
      },
    }));
    try {
      const next = await toggleReaction(contentId, visitorKey);
      setReactions((s) => ({ ...s, [contentId]: next }));
    } catch {
      setReactions((s) => ({ ...s, [contentId]: prev }));
    }
  };

  return (
    <div
      ref={activePostRef}
      className={`overflow-hidden rounded-2xl border shadow-sm ${isActivePostCentered ? "center-bounce-in" : ""}`}
      style={{ borderColor: theme.border }}
    >
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: theme.light }}>
        <span className="text-base">📢</span>
        <span className="text-sm font-bold" style={{ color: theme.text }}>今日のお知らせ</span>
        {activePosts.length > 1 && (
          <div className="ml-auto flex gap-1">
            {activePosts.map((_, i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full transition-colors"
                style={{ backgroundColor: i === currentPostIndex ? theme.accent : theme.border }}
              />
            ))}
          </div>
        )}
      </div>

      <div ref={activePostCarouselRef} className="flex snap-x snap-mandatory overflow-x-hidden scroll-smooth">
        {activePosts.map((post, index) => {
          const canOpenStory = !!post.id && !!post.imageUrl;
          const postBody = (
            <>
              {post.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.imageUrl} alt="お知らせ画像" className="h-48 w-full object-cover" />
              )}
              <p className="whitespace-pre-wrap px-4 pt-3 text-base leading-relaxed text-slate-800">
                {post.text}
              </p>
            </>
          );
          return (
            <article key={index} className="w-full shrink-0 snap-center">
              {canOpenStory ? (
                <button
                  type="button"
                  onClick={() => openStory(post)}
                  className="block w-full text-left"
                  aria-label="このお知らせをストーリーで見る"
                >
                  {postBody}
                </button>
              ) : (
                postBody
              )}
              <div className="mt-2 flex items-center justify-between px-4 pb-3 text-xs text-slate-400">
                {post.id ? (
                  <PostHeartButton
                    state={reactions[post.id]}
                    onToggle={() => handleToggle(post.id!)}
                  />
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-3">
                  <span>
                    {(() => {
                      const diff = new Date(post.expiresAt).getTime() - Date.now();
                      if (diff <= 0) return "期限切れ";
                      const h = Math.floor(diff / 3600000);
                      const m = Math.floor((diff % 3600000) / 60000);
                      return h > 0 ? `あと${h}時間` : `あと${m}分`;
                    })()}
                  </span>
                  {post.createdAt && (
                    <span>
                      {new Intl.DateTimeFormat("ja-JP", {
                        timeZone: "Asia/Tokyo",
                        month: "numeric",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(new Date(post.createdAt))}
                    </span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
