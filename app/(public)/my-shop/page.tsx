"use client";

import { useEffect, useState, type ElementType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Megaphone, Store, BarChart2, Sparkles, Settings, ChevronRight, BookOpen, MapPin, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { fetchVendorStore } from "@/app/vendor/_services/storeService";
import { fetchVendorPosts } from "@/app/vendor/_services/postsService";
import VendorNavBar from "@/components/vendor/VendorNavBar";

type MenuItem = {
  title: string;
  description: string;
  href: string;
  accent: string;
  icon: ElementType;
  badge?: string;
  primary?: boolean;
};

const PRIMARY_ACTIONS: MenuItem[] = [
  {
    title: "店舗情報を更新",
    description: "商品・写真・出店日をまとめて見直せます",
    href: "/vendor/store",
    accent: "from-emerald-400/75 to-emerald-100/90",
    icon: Store,
    badge: "まずここ",
    primary: true,
  },
  {
    title: "最新情報を発信",
    description: "今日のおすすめや売り切れを伝えられます",
    href: "/vendor/post/new",
    accent: "from-amber-400/75 to-amber-100/90",
    icon: Megaphone,
    primary: true,
  },
  {
    title: "AIに教える",
    description: "お店のことをAIに伝えるページです",
    href: "/vendor/ai-knowledge",
    accent: "from-rose-400/70 to-rose-100/90",
    icon: Sparkles,
  },
  {
    title: "使い方を見る",
    description: "画面の見方をやさしく案内します",
    href: "/vendor/help",
    accent: "from-sky-400/70 to-sky-100/90",
    icon: BookOpen,
  },
];

const SECONDARY_ACTIONS: MenuItem[] = [
  {
    title: "お店の分析",
    description: "どの情報が見られているか確認",
    href: "/vendor/analytics",
    accent: "from-violet-400/60 to-violet-100/80",
    icon: BarChart2,
  },
  {
    title: "アカウント設定",
    description: "名前やメール、パスワードの確認",
    href: "/vendor/account",
    accent: "from-slate-400/60 to-slate-100/80",
    icon: Settings,
  },
];

function ActionCard({
  item,
  compact = false,
}: {
  item: MenuItem;
  compact?: boolean;
}) {
  const Icon = item.icon;
  const isPrimary = item.primary ?? false;

  return (
    <Link
      href={item.href}
      className={`group relative block overflow-hidden rounded-[1.75rem] border transition active:scale-[0.99] ${
        compact
          ? "border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow-md"
          : "border-white/70 bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-lg"
      }`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${item.accent} ${compact ? "opacity-40" : "opacity-100"}`} />
      <div className={`relative flex min-h-[124px] flex-col justify-between p-4 ${compact ? "gap-3" : "gap-4"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {item.badge ? (
              <span className="mb-2 inline-flex rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white">
                {item.badge}
              </span>
            ) : null}
            <p className={`font-bold leading-tight text-slate-900 ${compact ? "text-lg" : "text-xl"}`}>
              {item.title}
            </p>
          </div>
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/90 text-slate-700 shadow-sm ${
              isPrimary ? "text-emerald-600" : ""
            }`}
          >
            <Icon size={20} />
          </span>
        </div>
        <p className={`max-w-[34rem] leading-relaxed text-slate-600 ${compact ? "text-sm" : "text-[15px]"}`}>
          {item.description}
        </p>
      </div>
    </Link>
  );
}

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
      className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_rgba(255,255,255,0))]"
      style={{ paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="border-b border-amber-100 bg-white/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-700">
              My Shop
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              出店者メニュー
            </h1>
          </div>
          {user?.name && (
            <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
              {user.name}
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 pt-4 md:pt-6">
        {isLoading ? (
          <div className="rounded-[1.75rem] border border-amber-100 bg-amber-50 px-5 py-4 text-base text-amber-800">
            ログイン状態を確認しています…
          </div>
        ) : !canAccess ? (
          <div className="rounded-[1.75rem] border border-rose-100 bg-rose-50 px-5 py-4 text-base text-rose-700">
            出店者としてログインしてください。
            <Link href="/login" className="ml-1 font-semibold underline">
              ログイン
            </Link>
          </div>
        ) : (
          <>
            {!permissions.isVendor && (
              <div className="mb-4 rounded-[1.75rem] border border-amber-100 bg-amber-50 px-5 py-4 text-base text-amber-800">
                現在のアカウントに出店者ロールが設定されていません。
              </div>
            )}

            <section className="mb-4 rounded-[2rem] border border-amber-100 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-sm font-semibold text-amber-700">まずはここから</p>
                  <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                    大きいボタンで、迷わず進めます
                  </h2>
                  <p className="mt-2 text-base leading-relaxed text-slate-600">
                    文字を大きく、選択肢を少なくして、見やすさを優先した画面です。
                  </p>
                </div>

                {summary && (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    {[
                      { label: "お店名", value: summary.shopName },
                      { label: "商品", value: `${summary.productCount}件` },
                      { label: "決済", value: `${summary.paymentCount}種類` },
                      { label: "出店日", value: `${summary.scheduleCount}日` },
                      { label: "投稿", value: `${summary.postCount}件` },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl bg-slate-50 px-3 py-3">
                        <p className="text-[11px] font-semibold text-slate-500">{item.label}</p>
                        <p className="mt-1 text-sm font-bold text-slate-900 sm:text-base">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/vendor/store"
                    className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-4 text-lg font-bold text-white shadow-sm transition hover:bg-emerald-500"
                  >
                    <Store size={20} />
                    店舗情報を更新
                  </Link>
                  <Link
                    href="/vendor/post/new"
                    className="flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-lg font-bold text-amber-800 transition hover:bg-amber-100"
                  >
                    <Megaphone size={20} />
                    最新情報を発信
                  </Link>
                </div>
              </div>
            </section>

            {showOnboarding && setupSteps && (
              <section
                id="setup-steps"
                className="mb-4 rounded-[2rem] border border-emerald-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">最初に整えること</p>
                    <h3 className="mt-1 text-2xl font-bold text-slate-900">必要な設定を順番に</h3>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                    {completedCount}/{setupSteps.length} 完了
                  </span>
                </div>

                <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${(completedCount / setupSteps.length) * 100}%` }}
                  />
                </div>

                <ul className="space-y-2">
                  {incompletedSteps.map((step, index) => (
                    <li key={step.label}>
                      <Link
                        href={step.href}
                        className="flex items-center gap-4 rounded-2xl bg-emerald-50 px-4 py-4 text-slate-800 transition hover:bg-emerald-100"
                      >
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-base font-bold text-emerald-600">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-base font-bold leading-tight">{step.label}</span>
                          <span className="mt-1 block text-sm text-emerald-700">タップで設定画面へ</span>
                        </span>
                        <ChevronRight size={18} className="flex-shrink-0 text-emerald-400" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mb-4">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">よく使う機能</p>
                  <p className="text-xs text-slate-500">大きいカードを順番に選べます</p>
                </div>
                {showOnboarding && (
                  <Link
                    href="#setup-steps"
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    設定を見る
                  </Link>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {PRIMARY_ACTIONS.map((item) => (
                  <ActionCard key={item.href} item={item} />
                ))}
              </div>
            </section>

            <section className="mb-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3">
                <p className="text-sm font-semibold text-slate-900">その他</p>
                <p className="text-xs text-slate-500">必要なときだけ開きます</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {SECONDARY_ACTIONS.map((item) => (
                  <ActionCard key={item.href} item={item} compact />
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-400">Exit & Return</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">戻る・ログアウト</h3>
              <p className="mt-2 text-base leading-relaxed text-slate-600">
                迷ったら地図へ戻れます。ここからログアウトもできます。
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Link
                  href="/map"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-4 text-lg font-bold text-white shadow-sm transition hover:bg-sky-500"
                >
                  <MapPin size={20} />
                  マップへ戻る
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-lg font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  <LogOut size={20} />
                  ログアウト
                </button>
              </div>
            </section>
          </>
        )}
      </div>
      <VendorNavBar />
    </div>
  );
}
