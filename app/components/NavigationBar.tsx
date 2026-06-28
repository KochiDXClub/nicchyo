"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useCallback, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBag } from "@/lib/storage/BagContext";
import { useMenu } from "@/lib/ui/MenuContext";

// ─── ナビゲーション項目 ────────────────────────────────────────────────────────
type NavItem = {
  name: string;
  href: string;
  icon: "search" | "chat" | "admin" | "book";
};

const baseNavItems: NavItem[] = [
  { name: "相談", href: "/map", icon: "chat" },
  { name: "図鑑", href: "/encyclopedia", icon: "book" },
];

// ─── セカンダリメニュー項目（2列グリッド） ────────────────────────────────────
const secondaryMenuItems = [
  { label: "バッジ",      href: "/badges",     emoji: "🏆", color: "bg-yellow-50",  textColor: "text-yellow-800", border: "border-yellow-100" },
  { label: "マイページ",  href: "/my-profile", emoji: "👤", color: "bg-violet-50",  textColor: "text-violet-800", border: "border-violet-100" },
  { label: "ニュース",    href: "/news",       emoji: "📰", color: "bg-sky-50",     textColor: "text-sky-800",    border: "border-sky-100"    },
  { label: "nicchyoとは", href: "/about",      emoji: "ℹ️", color: "bg-slate-50",   textColor: "text-slate-700",  border: "border-slate-100"  },
];

// ─── 出店者・管理者メニュー ────────────────────────────────────────────────────
const vendorMenuItems = [
  { label: "出店者ダッシュボード", href: "/vendor/dashboard", emoji: "🏪" },
  { label: "商品管理",            href: "/vendor/products",  emoji: "📦" },
  { label: "注文管理",            href: "/vendor/orders",    emoji: "📋" },
];

const adminMenuItems = [
  { label: "管理ダッシュボード", href: "/admin/dashboard", emoji: "⚙️" },
  { label: "ユーザー管理",       href: "/admin/users",     emoji: "👥" },
  { label: "コンテンツ管理",     href: "/admin/content",   emoji: "📝" },
];

// ─── Props ────────────────────────────────────────────────────────────────────
type NavigationBarProps = {
  activeHref?: string;
  position?: "fixed" | "absolute";
  onMenuOpenChange?: (open: boolean) => void;
  closeModeActive?: boolean;
  onCloseMode?: () => void;
  onConsultClick?: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────
function NavigationBarInner({
  activeHref,
  position = "fixed",
  onMenuOpenChange,
  closeModeActive = false,
  onCloseMode,
  onConsultClick,
}: NavigationBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoggedIn, permissions, logout } = useAuth();
  const { items: bagItems } = useBag();
  const { isMenuOpen: menuOpen, toggleMenu, closeMenu } = useMenu();

  useEffect(() => {
    onMenuOpenChange?.(menuOpen);
  }, [menuOpen, onMenuOpenChange]);

  const panel = searchParams?.get("panel");
  const isRoleConsoleArea =
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/vendor") ||
    pathname?.startsWith("/moderator");
  const isPanelOpen = pathname === "/map" && !!panel;
  const isCloseUxActive = isPanelOpen || closeModeActive;
  const isHome = (activeHref ?? pathname) === "/map" && !panel && !isCloseUxActive;

  const navItems = permissions.isSuperAdmin
    ? [...baseNavItems, { name: "管理", href: "/admin/dashboard", icon: "admin" as const }]
    : baseNavItems;

  const handleMenuItemClick = (href: string) => {
    closeMenu();
    router.push(href);
  };

  const handleCloseMode = useCallback(() => {
    if (onCloseMode) { onCloseMode(); return; }
    if (isPanelOpen) { router.push("/map"); }
  }, [isPanelOpen, onCloseMode, router]);

  const handleLogout = async () => {
    closeMenu();
    await logout();
    router.push("/map");
  };

  const roleLabel = permissions.isSuperAdmin
    ? { text: "管理者", color: "bg-red-100 text-red-700" }
    : permissions.isModerator
    ? { text: "モデレーター", color: "bg-purple-100 text-purple-700" }
    : permissions.isVendor
    ? { text: "出店者", color: "bg-amber-100 text-amber-700" }
    : null;

  if (isRoleConsoleArea) return null;

  return (
    <>
      {/* ── ボトムメニューシート ────────────────────────────────────────────── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* 背景オーバーレイ */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[9995] bg-black/40 backdrop-blur-sm"
              onClick={closeMenu}
            />

            {/* シート本体 */}
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 340 }}
              className="fixed bottom-0 left-0 right-0 z-[9996] rounded-t-[2rem] bg-[#FFFCF7] shadow-2xl"
              style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 5.5rem)" }}
            >
              {/* ドラッグハンドル */}
              <div className="mx-auto mt-3.5 mb-0 h-[5px] w-12 rounded-full bg-gray-200/80" />

              {/* スクロール領域 */}
              <div className="max-h-[78dvh] overflow-y-auto overscroll-contain px-4 pb-3 pt-4">

                {/* ─ ユーザーセクション ─ */}
                {isLoggedIn && user ? (
                  <div className="mb-4 flex items-center gap-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3.5 ring-1 ring-amber-100">
                    {user.avatarUrl ? (
                      <Image
                        src={user.avatarUrl}
                        alt={user.name}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow-sm"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-xl font-bold text-white shadow-sm ring-2 ring-white">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-gray-900">{user.name}</p>
                      {user.email && (
                        <p className="truncate text-[12px] text-gray-500 mt-0.5">{user.email}</p>
                      )}
                    </div>
                    {roleLabel && (
                      <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${roleLabel.color}`}>
                        {roleLabel.text}
                      </span>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleMenuItemClick("/login")}
                    className="mb-4 flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 px-4 py-4 text-left transition active:scale-[0.98] active:bg-amber-50"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100">
                      <svg className="h-6 w-6 text-amber-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-gray-800">ログイン / 登録</p>
                      <p className="mt-0.5 text-[12px] text-gray-400">アカウントでもっと便利に</p>
                    </div>
                    <svg className="ml-auto h-5 w-5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}

                {/* ─ プライマリ：バッグ ─ */}
                <button
                  type="button"
                  onClick={() => handleMenuItemClick("/bag")}
                  className={`mb-4 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition active:scale-[0.98] ${
                    bagItems.length > 0
                      ? "border border-amber-200 bg-amber-50"
                      : "border border-slate-100 bg-white shadow-sm"
                  }`}
                >
                  <div className="relative shrink-0">
                    <span className="text-xl">🛍️</span>
                    {bagItems.length > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white">
                        {bagItems.length}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[14px] font-bold ${bagItems.length > 0 ? "text-amber-800" : "text-gray-700"}`}>
                      バッグ
                    </p>
                    {bagItems.length > 0 && (
                      <p className="text-[12px] text-amber-600">{bagItems.length}品入っています</p>
                    )}
                  </div>
                  <svg className="h-4 w-4 shrink-0 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <hr className="mb-4 border-slate-100" />

                {/* ─ セカンダリ：2列グリッド ─ */}
                <div className="mb-4 grid grid-cols-2 gap-3">
                  {secondaryMenuItems.map((item, i) => (
                    <motion.button
                      key={item.href}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05, type: "spring", damping: 18, stiffness: 280 }}
                      onClick={() => handleMenuItemClick(item.href)}
                      className={`flex items-center gap-3 rounded-2xl border ${item.border} ${item.color} px-4 py-3.5 transition active:scale-[0.97]`}
                    >
                      <span className="text-xl">{item.emoji}</span>
                      <span className={`text-[13px] font-bold ${item.textColor}`}>{item.label}</span>
                    </motion.button>
                  ))}
                </div>

                {/* ─ 補足：テキストリンク ─ */}
                <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 px-1">
                  <button
                    type="button"
                    onClick={() => handleMenuItemClick("/recipes")}
                    className="text-[13px] text-slate-400 transition hover:text-slate-600"
                  >
                    🍳 レシピ
                  </button>
                </div>

                <hr className="mb-4 border-slate-100" />

                {/* ─ 出店者メニュー ─ */}
                {(permissions.isVendor || permissions.isSuperAdmin) && (
                  <div className="mb-4">
                    <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-500">出店者</p>
                    <div className="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm">
                      {vendorMenuItems.map((item, i) => (
                        <button
                          type="button"
                          key={item.href}
                          onClick={() => handleMenuItemClick(item.href)}
                          className={`flex w-full items-center gap-4 px-4 py-[14px] text-left transition active:bg-amber-50 ${i !== 0 ? "border-t border-gray-100" : ""}`}
                        >
                          <span className="text-xl">{item.emoji}</span>
                          <span className="flex-1 text-[14px] font-semibold text-gray-800">{item.label}</span>
                          <svg className="h-4 w-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ─ 管理メニュー ─ */}
                {permissions.isSuperAdmin && (
                  <div className="mb-4">
                    <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-red-400">管理者</p>
                    <div className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
                      {adminMenuItems.map((item, i) => (
                        <button
                          type="button"
                          key={item.href}
                          onClick={() => handleMenuItemClick(item.href)}
                          className={`flex w-full items-center gap-4 px-4 py-[14px] text-left transition active:bg-red-50 ${i !== 0 ? "border-t border-gray-100" : ""}`}
                        >
                          <span className="text-xl">{item.emoji}</span>
                          <span className="flex-1 text-[14px] font-semibold text-gray-800">{item.label}</span>
                          <svg className="h-4 w-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ─ ログアウト ─ */}
                {isLoggedIn && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-gray-200 bg-white py-[14px] text-[14px] font-semibold text-gray-500 shadow-sm transition active:bg-gray-50 active:scale-[0.98]"
                  >
                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                    </svg>
                    ログアウト
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── ナビゲーションバー ──────────────────────────────────────────────── */}
      <nav
        onClick={isCloseUxActive ? handleCloseMode : undefined}
        className={`navigation-bar ${position} bottom-0 left-0 right-0 z-[9997] border-t text-sm leading-none shadow-sm transition-colors duration-300 ${
          isCloseUxActive
            ? "cursor-pointer border-green-500 bg-green-500"
            : "border-gray-200/60 bg-white/90 backdrop-blur-md"
        }`}
        style={{ paddingBottom: "var(--safe-bottom, 0px)" }}
      >
        {isHome ? (
          /* ── マップ：フルナビ ── */
          <div className="mx-auto flex h-14 max-w-lg items-center">
            {/* 左：相談 */}
            {onConsultClick ? (
              <button
                type="button"
                onClick={onConsultClick}
                className="group flex h-full flex-1 flex-col items-center justify-center gap-1 text-gray-400 transition-all duration-200 hover:bg-gray-50/50 hover:text-gray-600"
              >
                <NavIcon
                  name={navItems[0].icon}
                  className="h-6 w-6 transition-transform duration-200 group-hover:scale-105"
                />
                <span className="text-[10px] font-medium leading-none tracking-tight">
                  {navItems[0].name}
                </span>
              </button>
            ) : (
              <NavLinkItem
                item={navItems[0]}
                isActive={(activeHref ?? pathname) === navItems[0].href}
              />
            )}

            {/* 中央：メニューボタン */}
            <div className="flex flex-1 items-center justify-center">
              <button
                type="button"
                onClick={toggleMenu}
                className="flex flex-col items-center gap-1 transition-all duration-200 active:scale-95"
              >
                <motion.div
                  animate={menuOpen ? { rotate: 45, scale: 1.1 } : { rotate: 0, scale: 1 }}
                  transition={{ type: "spring", damping: 20, stiffness: 300 }}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-900 text-white shadow-md"
                >
                  <MenuGridIcon className="h-5 w-5" />
                </motion.div>
                <span className="text-[10px] font-medium leading-none tracking-tight text-gray-500">
                  メニュー
                </span>
              </button>
            </div>

            {/* 右：お店を探す（+ 管理タブがあれば追加） */}
            {navItems.slice(1).map((item) => (
              <NavLinkItem
                key={item.href}
                item={item}
                isActive={(activeHref ?? pathname) === item.href}
              />
            ))}
          </div>
        ) : isCloseUxActive ? (
          /* ── パネル表示中：緑バー × ── */
          <div className="mx-auto flex h-14 max-w-lg items-center justify-center">
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="text-[10px] font-medium leading-none tracking-tight text-white/80">
                閉じる
              </span>
            </div>
          </div>
        ) : (
          /* ── サブページ：もどるバー ── */
          <div className="mx-auto flex h-14 max-w-lg items-center px-4">
            <button
              type="button"
              onClick={() => router.push("/map")}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-gray-600 transition active:scale-95 hover:bg-gray-100"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              マップにもどる
            </button>
          </div>
        )}
      </nav>
    </>
  );
}

// ─── NavLinkItem ──────────────────────────────────────────────────────────────
function NavLinkItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      prefetch={false}
      className={`group flex h-full flex-1 flex-col items-center justify-center gap-1 transition-all duration-200 ${
        isActive
          ? "text-amber-600"
          : "text-gray-400 hover:bg-gray-50/50 hover:text-gray-600"
      }`}
    >
      <NavIcon
        name={item.icon}
        className={`h-6 w-6 transition-transform duration-200 ${
          isActive ? "scale-105" : "group-hover:scale-105"
        }`}
      />
      <span className="text-[10px] font-medium leading-none tracking-tight">
        {item.name}
      </span>
    </Link>
  );
}

export default function NavigationBar(props: NavigationBarProps) {
  return (
    <Suspense>
      <NavigationBarInner {...props} />
    </Suspense>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function MenuGridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <rect x="3"  y="3"  width="7" height="7" rx="1.5" />
      <rect x="14" y="3"  width="7" height="7" rx="1.5" />
      <rect x="3"  y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

type NavIconProps = { name: NavItem["icon"]; className?: string };

function NavIcon({ name, className }: NavIconProps) {
  const props = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  } as const;

  switch (name) {
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="6.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 16.5 20 20" />
        </svg>
      );
    case "chat":
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5A2.25 2.25 0 0 1 19.5 6.75v6A2.25 2.25 0 0 1 17.25 15H9l-3.75 3v-3H6.75A2.25 2.25 0 0 1 4.5 12.75v-6Z"
          />
        </svg>
      );
    case "book":
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18c-2.305 0-4.408.867-6 2.292m0-14.25v14.25"
          />
        </svg>
      );
    case "admin":
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      );
    default:
      return null;
  }
}
