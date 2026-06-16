"use client";

import { useEffect, useState, type ElementType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Megaphone, Store, BarChart2, Sparkles, Settings, ChevronRight, BookOpen, MapPin, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { fetchVendorStore } from "@/app/vendor/_services/storeService";
import { fetchVendorPosts } from "@/app/vendor/_services/postsService";
import VendorNavBar from "@/components/vendor/VendorNavBar";

const MENU_ITEMS: {
  title: string;
  description: string;
  href: string;
  accent: string;
  icon: ElementType;
  badge?: string;
}[] = [
  {
    title: "最新情報を発信",
    description: "今日のおすすめ・残り数量など",
    href: "/vendor/post/new",
    accent: "from-amber-400/60 to-amber-100/80",
    icon: Megaphone,
  },
  {
    title: "お店の分析",
    description: "閲覧数・人気商品・時間帯分析",
    href: "/vendor/analytics",
    accent: "from-violet-400/60 to-violet-100/80",
    icon: BarChart2,
  },
  {
    title: "出店情報を更新",
    description: "商品・決済方法・出店日",
    href: "/vendor/store",
    accent: "from-emerald-400/60 to-emerald-100/80",
    icon: Store,
  },
  {
    title: "AIに教える",
    description: "お店の情報をAIに学習させる",
    href: "/vendor/ai-knowledge",
    accent: "from-rose-400/60 to-rose-100/80",
    icon: Sparkles,
  },
  {
    title: "使い方ガイド",
    description: "各機能の説明・Tips",
    href: "/vendor/help",
    accent: "from-sky-400/60 to-sky-100/80",
    icon: BookOpen,
  },
  {
    title: "アカウント設定",
    description: "名前・メール・パスワード変更",
    href: "/vendor/account",
    accent: "from-slate-400/60 to-slate-100/80",
    icon: Settings,
  },
];

type SetupStep = {
  label: string;
  done: boolean;
  href: string;
};

export default function MyShopPage() {
  const { isLoggedIn, user, permissions, isLoading, logout } = useAuth();
  const router = useRouter();
  const canAccess = !isLoading && isLoggedIn;

  const [setupSteps, setSetupSteps] = useState<SetupStep[] | null>(null);
  const [summary, setSummary] = useState<{
    shopName: string;
    productCount: number;
    paymentCount: number;
    scheduleCount: number;
    postCount: number;
    hasPhoto: boolean;
  } | null>(null);
  useEffect(() => {
    if (!user) return;

    Promise.all([fetchVendorStore(user.id), fetchVendorPosts(user.id)]).then(([store, posts]) => {
      setSummary({
        shopName: store?.name?.trim() || "未設定",
        productCount: store?.main_products.length ?? 0,
        paymentCount: store?.payment_methods.length ?? 0,
        scheduleCount: store?.schedule.length ?? 0,
        postCount: posts.length,
        hasPhoto: !!store?.shop_image_url,
      });

      if (!store) return;
      const steps: SetupStep[] = [
        { label: "店舗名を設定する", done: !!store.name?.trim(), href: "/vendor/store" },
        { label: "商品を追加する", done: store.main_products.length > 0, href: "/vendor/store" },
        { label: "出店予定日を設定する", done: store.schedule.length > 0, href: "/vendor/store" },
        { label: "決済方法を設定する", done: store.payment_methods.length > 0, href: "/vendor/store" },
        { label: "店舗写真を追加する", done: !!store.shop_image_url, href: "/vendor/store" },
        { label: "最初の投稿をする", done: posts.length > 0, href: "/vendor/post/new" },
      ];
      setSetupSteps(steps);
    }).catch(() => {
      // 取得失敗時は非表示
    });
  }, [user]);

  const incompletedSteps = setupSteps?.filter((s) => !s.done) ?? [];
  const completedCount = setupSteps ? setupSteps.length - incompletedSteps.length : 0;
  const showOnboarding = setupSteps !== null && incompletedSteps.length > 0;

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div
      className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_rgba(255,255,255,0))]"
      style={{ paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {/* ヘッダー */}
      <div className="border-b border-amber-100 bg-white/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between md:max-w-4xl">
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">出店者メニュー</h1>
          {user?.name && (
            <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {user.name}
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 pt-4 md:max-w-4xl md:pt-6">
        {isLoading ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ログイン状態を確認しています…
          </div>
        ) : !canAccess ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            出店者としてログインしてください。
            <Link href="/login" className="ml-1 font-semibold underline">ログイン</Link>
          </div>
        ) : (
          <>
            {!permissions.isVendor && (
              <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                現在のアカウントに出店者ロールが設定されていません。
              </div>
            )}

            <div className="mb-4 rounded-3xl border border-amber-100 bg-white p-4 shadow-sm md:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-600">Vendor Menu</p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                    {summary?.shopName === "未設定" ? "お店の準備を進めましょう" : `${summary?.shopName} さんの出店メニュー`}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    まずは「最新情報」「店舗情報」「AIばあちゃん」の3つを整えると、お客さんに伝わりやすくなります。
                  </p>
                </div>
                <div className="grid gap-2 md:w-[320px]">
                  <Link href="/vendor/post/new" className="rounded-2xl bg-amber-500 px-4 py-3.5 text-center text-base font-bold text-white shadow-sm transition hover:bg-amber-400">
                    最新情報を発信する
                  </Link>
                  <div className="grid grid-cols-2 gap-2">
                    <Link href="/vendor/store" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-700 transition hover:bg-amber-100">
                      店舗情報を更新
                    </Link>
                    <Link href="/vendor/help" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                      使い方を見る
                    </Link>
                  </div>
                </div>
              </div>

              {summary && (
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                  {[
                    { label: "商品", value: `${summary.productCount}件` },
                    { label: "決済", value: `${summary.paymentCount}種` },
                    { label: "出店日", value: `${summary.scheduleCount}日` },
                    { label: "投稿", value: `${summary.postCount}件` },
                    { label: "写真", value: summary.hasPhoto ? "あり" : "未設定" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl bg-slate-50 px-3 py-3">
                      <p className="text-[11px] font-semibold text-slate-500">{item.label}</p>
                      <p className="mt-1 text-base font-bold text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 初回オンボーディング */}
            {showOnboarding && (
              <div id="setup-steps" className="mb-4 rounded-3xl border border-emerald-200 bg-white p-4 shadow-sm md:p-5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-lg font-bold text-slate-900">はじめに整えること</p>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {completedCount}/{setupSteps!.length}完了
                  </span>
                </div>
                <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${(completedCount / setupSteps!.length) * 100}%` }}
                  />
                </div>
                <ul className="space-y-2">
                  {incompletedSteps.map((step, index) => (
                    <li key={step.label}>
                      <Link
                        href={step.href}
                        className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-4 text-slate-700 transition hover:bg-emerald-100"
                      >
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-emerald-500">
                          {index + 1}
                        </span>
                        <span className="flex-1 text-sm font-semibold">{step.label}</span>
                        <ChevronRight size={16} className="flex-shrink-0 text-slate-400" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* メニューグリッド */}
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">よく使う機能</p>
                <p className="text-xs text-slate-500">大きいカードをタップして進めます</p>
              </div>
              <Link href="/vendor/help" className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 md:inline-flex">
                使い方ガイド
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group relative overflow-hidden rounded-3xl border border-white/60 bg-white shadow-sm transition active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${item.accent}`} />
                    <div className="relative flex min-h-[128px] flex-col justify-between p-4 md:min-h-[140px] md:p-5">
                      <div className="flex items-start justify-between">
                        {item.badge ? (
                          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                            {item.badge}
                          </span>
                        ) : (
                          <span />
                        )}
                        <span className="rounded-2xl border border-white/70 bg-white/90 p-2.5 text-slate-700 shadow-sm">
                          <Icon size={20} />
                        </span>
                      </div>
                      <div>
                        <p className="text-base font-bold leading-tight text-slate-900 md:text-lg">{item.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600 md:text-sm">{item.description}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Exit & Return</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">戻る・ログアウト</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                迷ったら地図に戻れます。ここからログアウトもできます。
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Link
                  href="/map"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-400"
                >
                  <MapPin size={16} />
                  マップへ戻る
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  <LogOut size={16} />
                  ログアウト
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      <VendorNavBar />
    </div>
  );
}
