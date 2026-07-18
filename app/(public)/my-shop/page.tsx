"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Store, Megaphone, ChevronRight, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { fetchVendorStore } from "@/app/vendor/_services/storeService";
import { fetchVendorPosts } from "@/app/vendor/_services/postsService";
import type { Post } from "@/app/vendor/_types";
import ClosedDaysCalendar from "@/components/vendor/ClosedDaysCalendar";

type SetupStep = {
  label: string;
  done: boolean;
  href: string;
};

type Summary = {
  shopName: string;
  productCount: number;
  scheduleCount: number;
  postCount: number;
};

// 今日から次の日曜市（毎週日曜開催）までの日数。0なら当日。
function daysUntilNextSunday(): number {
  return (7 - new Date().getDay()) % 7;
}

export default function MyShopPage() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();

  const [setupSteps, setSetupSteps] = useState<SetupStep[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!user) return;

    Promise.all([fetchVendorStore(user.id), fetchVendorPosts(user.id)])
      .then(([store, posts]) => {
        setPosts(posts);
        setSummary({
          shopName: store?.name?.trim() || "お店の名前は未設定",
          productCount: store?.main_products.length ?? 0,
          scheduleCount: store?.schedule.length ?? 0,
          postCount: posts.length,
        });

        if (!store) return;
        setSetupSteps([
          { label: "店舗名を設定する", done: !!store.name?.trim(), href: "/vendor/store" },
          { label: "商品を追加する", done: store.main_products.length > 0, href: "/vendor/store" },
          { label: "出店予定日を設定する", done: store.schedule.length > 0, href: "/vendor/store" },
          { label: "決済方法を設定する", done: store.payment_methods.length > 0, href: "/vendor/store" },
          { label: "店舗写真を追加する", done: !!store.shop_image_url, href: "/vendor/store" },
          { label: "最初の投稿をする", done: posts.length > 0, href: "/vendor/post/new" },
        ]);
      })
      .catch(() => {
        // 取得失敗時は静かに非表示
      });
  }, [user]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 96);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const incompleteSteps = setupSteps?.filter((s) => !s.done) ?? [];
  const completedCount = setupSteps ? setupSteps.length - incompleteSteps.length : 0;
  const showSetup = setupSteps !== null && incompleteSteps.length > 0;

  const sundayLabel = useMemo(() => {
    const d = daysUntilNextSunday();
    return d === 0 ? "きょうは日曜市の日" : `次の日曜市まで あと${d}日`;
  }, []);

  const shopName = summary?.shopName ?? "";

  // 背景の線画に直接載る文字を守るクリームのグロー（袋文字を使わず柔らかく）
  const textGlow =
    "[text-shadow:0_1px_14px_rgba(255,250,240,0.95),0_0_3px_rgba(255,250,240,0.9)]";

  return (
    <div
      className="relative min-h-screen"
      style={{ paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {/* 背景：日曜市のライン画（画面全体・スクロールで固定） */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/images/my-shop-bg.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="scale-105 object-cover object-center blur-[1px]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/20 to-nicchyo-base/60" />
      </div>

      {/* スクロールで現れる細いスティッキーバー */}
      <AnimatePresence>
        {scrolled && shopName && (
          <motion.div
            key="slimbar"
            initial={reduceMotion ? false : { y: -48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { y: -48, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="fixed inset-x-0 top-0 z-30 border-b border-amber-100/70 bg-white/85 backdrop-blur-md"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-4 py-3">
              <span className="text-lg" aria-hidden="true">🏪</span>
              <p className="truncate font-display text-base text-nicchyo-ink">{shopName}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 mx-auto w-full max-w-3xl px-4">
        {/* 挨拶ヒーロー */}
        <header className="pb-8 pt-14 sm:pt-20">
          <p className={`eyebrow ${textGlow}`}>My Shop</p>
          <h1 className={`mt-2 font-display text-[2rem] leading-tight text-nicchyo-ink sm:text-4xl ${textGlow}`}>
            おかえりなさい{user?.name ? `、${user.name}さん` : ""}
          </h1>
          <p className={`mt-3 text-[15px] font-medium text-slate-600 ${textGlow}`}>
            {shopName && <span className="font-bold text-nicchyo-ink">{shopName}</span>}
            {shopName && <span className="mx-2 text-amber-300" aria-hidden="true">·</span>}
            <span className="text-amber-700">{sundayLabel}</span>
          </p>
        </header>

        {/* お店の準備（未完了のときだけ） */}
        {showSetup && setupSteps && (
          <Reveal reduceMotion={reduceMotion} className="mb-5">
            <section className="rounded-panel border border-amber-100 bg-white/85 p-5 shadow-card backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-display text-xl text-nicchyo-ink">お店の準備</h2>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
                  あと{incompleteSteps.length}件
                </span>
              </div>

              <div className="mb-4 h-2.5 w-full overflow-hidden rounded-full bg-amber-100/70">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${(completedCount / setupSteps.length) * 100}%` }}
                />
              </div>

              <ul className="space-y-2">
                {incompleteSteps.map((step, i) => (
                  <li key={step.label}>
                    <Link
                      href={step.href}
                      className="flex items-center gap-3.5 rounded-2xl bg-amber-50/80 px-4 py-3.5 text-nicchyo-ink transition active:scale-[0.99] active:bg-amber-100"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-amber-600 shadow-sm">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 text-[15px] font-bold leading-tight">
                        {step.label}
                      </span>
                      <ChevronRight size={18} className="shrink-0 text-amber-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>
        )}

        {/* 主要アクション：いちばん使うのは「発信」 */}
        <Reveal reduceMotion={reduceMotion} className="mb-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/vendor/post/new"
              className="flex items-center justify-center gap-2.5 rounded-panel bg-amber-500 px-4 py-5 text-lg font-bold text-white shadow-brand-pop transition active:scale-[0.99] hover:bg-amber-400"
            >
              <Megaphone size={22} />
              最新情報を発信
            </Link>
            <Link
              href="/vendor/store"
              className="flex items-center justify-center gap-2.5 rounded-panel border border-amber-200 bg-white/85 px-4 py-5 text-lg font-bold text-amber-800 shadow-card backdrop-blur-sm transition active:scale-[0.99] hover:bg-amber-50"
            >
              <Store size={22} />
              店舗情報を更新
            </Link>
          </div>
        </Reveal>

        {/* 状況ストリップ（1行に整理） */}
        {summary && (
          <Reveal reduceMotion={reduceMotion} className="mb-6">
            <div className="flex items-stretch divide-x divide-amber-100 overflow-hidden rounded-panel border border-amber-100 bg-white/75 shadow-card backdrop-blur-sm">
              {[
                { label: "商品", value: `${summary.productCount}` },
                { label: "出店日", value: `${summary.scheduleCount}` },
                { label: "投稿", value: `${summary.postCount}` },
              ].map((s) => (
                <div key={s.label} className="flex flex-1 flex-col items-center gap-0.5 px-3 py-4">
                  <span className="font-display text-2xl text-nicchyo-ink">{s.value}</span>
                  <span className="text-xs font-semibold text-slate-500">{s.label}</span>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {/* 出店しない日（日曜帯・ホームでは簡易版） */}
        {user?.id && (
          <Reveal reduceMotion={reduceMotion} className="mb-6">
            <div>
              <ClosedDaysCalendar vendorId={user.id} variant="strip" />
              <div className="mt-2 text-right">
                <Link
                  href="/my-shop/schedule"
                  className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-amber-700 shadow-sm backdrop-blur-sm transition active:scale-95"
                >
                  カレンダーで編集
                  <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          </Reveal>
        )}

        {/* 最近の投稿 */}
        {posts !== null && (
          <Reveal reduceMotion={reduceMotion} className="mb-6">
            <section>
              <div className="mb-3 flex items-end justify-between gap-3">
                <h2 className={`font-display text-xl text-nicchyo-ink ${textGlow}`}>最近の投稿</h2>
                {posts.length > 0 && (
                  <Link
                    href="/vendor/posts"
                    className="rounded-full border border-amber-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-amber-700 shadow-sm backdrop-blur-sm transition active:scale-95"
                  >
                    すべて見る
                  </Link>
                )}
              </div>

              {posts.length === 0 ? (
                <Link
                  href="/vendor/post/new"
                  className="flex items-center gap-4 rounded-panel border border-dashed border-amber-300 bg-white/80 p-5 shadow-card backdrop-blur-sm transition active:scale-[0.99]"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                    <Sparkles size={22} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold text-nicchyo-ink">
                      はじめての発信をしてみましょう
                    </span>
                    <span className="mt-0.5 block text-[13px] text-slate-500">
                      今日のおすすめや、お休みのお知らせを届けられます
                    </span>
                  </span>
                </Link>
              ) : (
                <ul className="space-y-3">
                  {posts.slice(0, 3).map((post) => (
                    <li key={post.id}>
                      <div className="flex gap-3.5 rounded-panel border border-amber-100 bg-white/85 p-3.5 shadow-card backdrop-blur-sm">
                        {post.image_url && (
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-amber-50">
                            <Image
                              src={post.image_url}
                              alt=""
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[14px] leading-relaxed text-nicchyo-ink">
                            {post.text || "（本文なし）"}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[12px] text-slate-400">
                              {formatPostDate(post.created_at)}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                post.status === "active"
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-slate-100 text-slate-400"
                              }`}
                            >
                              {post.status === "active" ? "掲載中" : "掲載終了"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </Reveal>
        )}

        {/* ほかの機能はメニューへ誘導（下部バー中央） */}
        <p className={`pb-2 text-center text-[13px] text-slate-500 ${textGlow}`}>
          ほかの機能は下の
          <span className="mx-1 font-bold text-amber-700">メニュー</span>
          から
        </p>
      </div>
    </div>
  );
}

// 投稿日を「M月D日」で表示
function formatPostDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// スクロールで視界に入ったとき控えめにフェードアップ（reduced-motion尊重）
function Reveal({
  children,
  className,
  reduceMotion,
}: {
  children: ReactNode;
  className?: string;
  reduceMotion: boolean | null;
}) {
  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
