"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useCallback, useRef, Suspense } from "react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CircleHelp,
  ClipboardList,
  Compass,
  FileText,
  Info,
  LayoutDashboard,
  LayoutGrid,
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
  MessageCircle,
  Newspaper,
  Package,
  Settings,
  Store,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useMenu } from "@/lib/ui/MenuContext";
import { usePageVisibility } from "@/lib/pageVisibility/PageVisibilityContext";
import { useMapLoading } from "./MapLoadingProvider";
import MenuGrandma from "./MenuGrandma";

// ─── ナビゲーション項目 ────────────────────────────────────────────────────────
type NavItem = {
  name: string;
  href: string;
  /** 実際に遷移するページ（href と異なる場合）。ページ公開設定の判定に使う */
  target?: string;
  icon: LucideIcon;
};

const baseNavItems: NavItem[] = [
  // 相談ボタンはマップ上では onConsultClick 経由で /consult へ遷移する
  { name: "相談", href: "/map", target: "/consult", icon: MessageCircle },
  { name: "近況", href: "/story", icon: Newspaper },
];

// ─── メニューの項目 ───────────────────────────────────────────────────────────
// 絵文字は端末ごとに絵柄が変わって揃わないので、線の太さを合わせたアイコンを使う。
type SheetItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

/** 日曜市を歩くときに使うページ */
const visitMenuItems: SheetItem[] = [
  { label: "おでかけサポート", href: "/facilities", icon: Compass },
  { label: "日曜市カレンダー", href: "/calendar", icon: CalendarDays },
  { label: "日曜市をデータで見る", href: "/analysis", icon: BarChart3 },
];

/** nicchyo そのものについてのページ */
const aboutMenuItems: SheetItem[] = [
  { label: "nicchyoとは", href: "/about", icon: Info },
  { label: "よくある質問", href: "/faq", icon: CircleHelp },
  { label: "お問い合わせ", href: "/contact", icon: Mail },
  { label: "プライバシーポリシー", href: "/privacy", icon: ShieldCheck },
];

// ─── 出店者・管理者メニュー ────────────────────────────────────────────────────
const vendorMenuItems: SheetItem[] = [
  { label: "出店者ダッシュボード", href: "/vendor/dashboard", icon: Store },
  { label: "商品管理", href: "/vendor/products", icon: Package },
  { label: "注文管理", href: "/vendor/orders", icon: ClipboardList },
];

const adminMenuItems: SheetItem[] = [
  { label: "管理ダッシュボード", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "ユーザー管理", href: "/admin/users", icon: Users },
  { label: "コンテンツ管理", href: "/admin/content", icon: FileText },
];

/** iOS のシートに近い、最後にすっと止まる曲線 */
const EASE_OUT_SHEET: [number, number, number, number] = [0.32, 0.72, 0, 1];
const EASE_IN_SHEET: [number, number, number, number] = [0.4, 0, 1, 1];

// ─── body のスクロール固定 ────────────────────────────────────────────────────
/**
 * NavigationBar はマップ読み込み中など同時に2つ描かれることがあるので、
 * 数を数えてから外す。片方が閉じただけで背面が動き出さないようにする。
 */
let scrollLockCount = 0;

function lockBodyScroll() {
  scrollLockCount += 1;
  if (scrollLockCount === 1) document.body.style.overflow = "hidden";
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) document.body.style.overflow = "";
}

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
  const { isMenuOpen: menuOpen, toggleMenu, closeMenu } = useMenu();
  const { isLinkVisible } = usePageVisibility();
  const { startMapLoading } = useMapLoading();
  const prefersReducedMotion = useReducedMotion();
  const dragControls = useDragControls();
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    onMenuOpenChange?.(menuOpen);
  }, [menuOpen, onMenuOpenChange]);

  // 開いている間は背面を固定し、Esc で閉じられるようにする
  useEffect(() => {
    if (!menuOpen) return;
    lockBodyScroll();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unlockBodyScroll();
    };
  }, [menuOpen, closeMenu]);

  // 閉じたらメニューボタンへフォーカスを戻す（キーボード操作が迷子にならないように）
  const wasMenuOpen = useRef(false);
  useEffect(() => {
    if (wasMenuOpen.current && !menuOpen) menuButtonRef.current?.focus();
    wasMenuOpen.current = menuOpen;
  }, [menuOpen]);

  const panel = searchParams?.get("panel");
  const isRoleConsoleArea =
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/vendor") ||
    pathname?.startsWith("/moderator");
  const isPanelOpen = pathname === "/map" && !!panel;
  const isCloseUxActive = isPanelOpen || closeModeActive;
  const isHome = (activeHref ?? pathname) === "/map" && !panel && !isCloseUxActive;

  // ページ公開設定で public でないリンクはナビに出さない
  const consultItem = baseNavItems[0];
  const isConsultVisible = isLinkVisible(consultItem.target ?? consultItem.href);
  const rightNavItems = (
    permissions.isAdmin
      ? [...baseNavItems.slice(1), { name: "管理", href: "/admin/dashboard", icon: Settings }]
      : baseNavItems.slice(1)
  ).filter((item) => isLinkVisible(item.target ?? item.href));
  const visibleVisitItems = visitMenuItems.filter((item) => isLinkVisible(item.href));
  const visibleAboutItems = aboutMenuItems.filter((item) => isLinkVisible(item.href));
  const visibleVendorItems = vendorMenuItems.filter((item) => isLinkVisible(item.href));

  // router.push はリンクと違って Provider のクリック監視に掛からないので、/map へ向かう前に自分で始める
  const goToMap = useCallback(() => {
    startMapLoading();
    router.push("/map");
  }, [router, startMapLoading]);

  const handleMenuItemClick = (href: string) => {
    closeMenu();
    if (href === "/map") { goToMap(); return; }
    router.push(href);
  };

  const handleCloseMode = useCallback(() => {
    if (onCloseMode) { onCloseMode(); return; }
    if (isPanelOpen) { goToMap(); }
  }, [isPanelOpen, onCloseMode, goToMap]);

  const handleLogout = async () => {
    closeMenu();
    await logout();
    goToMap();
  };

  /** ハンドルを下に引いたら閉じる */
  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    if (info.offset.y > 90 || info.velocity.y > 600) closeMenu();
  };

  const roleLabel = permissions.isAdmin
    ? "管理者"
    : permissions.isModerator
    ? "モデレーター"
    : permissions.isVendor
    ? "出店者"
    : null;

  // シートは「ひとかたまり」で上がってくる。要素ごとに遅れて現れると点滅して見えるので、
  // 中身には一切アニメーションを掛けない。
  const sheetTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.46, ease: EASE_OUT_SHEET };
  const sheetExitTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: EASE_IN_SHEET };
  const fadeTransition = { duration: prefersReducedMotion ? 0 : 0.2 };

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
              transition={fadeTransition}
              className="fixed inset-0 z-[9995] bg-slate-900/40 backdrop-blur-[3px]"
              onClick={closeMenu}
              aria-hidden
            />

            {/* シート本体 */}
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-label="メニュー"
              tabIndex={-1}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%", transition: sheetExitTransition }}
              transition={sheetTransition}
              drag="y"
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.55 }}
              dragMomentum={false}
              onDragEnd={handleDragEnd}
              className="fixed bottom-0 left-0 right-0 z-[9996] mx-auto w-full max-w-lg rounded-t-[28px] bg-nicchyo-base shadow-[0_-16px_48px_-12px_rgba(58,58,58,0.3)] ring-1 ring-nicchyo-ink/[0.07] outline-none"
              style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 5.5rem)" }}
            >
              {/* ドラッグハンドル（下に引くと閉じる） */}
              <div
                onPointerDown={(event) => dragControls.start(event)}
                className="flex cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing"
              >
                <span className="h-[5px] w-11 rounded-full bg-nicchyo-ink/15" aria-hidden />
              </div>

              {/* スクロール領域 */}
              <div className="max-h-[74dvh] overflow-y-auto overscroll-contain px-3 pb-2 pt-1">

                {/* ─ ユーザー ─ */}
                {isLoggedIn && user ? (
                  <button
                    type="button"
                    onClick={() => handleMenuItemClick("/my-profile")}
                    className="flex w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left transition active:bg-nicchyo-ink/[0.05]"
                  >
                    {user.avatarUrl ? (
                      <Image
                        src={user.avatarUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-nicchyo-primary text-[15px] font-bold text-white">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-nicchyo-ink">
                      {user.name}
                    </span>
                    {roleLabel && (
                      <span className="shrink-0 text-[12px] font-medium text-nicchyo-ink/45">{roleLabel}</span>
                    )}
                  </button>
                ) : (
                  <MenuRow
                    icon={LogIn}
                    label="ログイン / 登録"
                    onClick={() => handleMenuItemClick("/login")}
                  />
                )}

                <MenuDivider />

                {/* ─ 日曜市を歩くためのページ ─ */}
                {visibleVisitItems.map((item) => (
                  <MenuRow
                    key={item.href}
                    icon={item.icon}
                    label={item.label}
                    onClick={() => handleMenuItemClick(item.href)}
                  />
                ))}

                {/* ─ nicchyo について（右の余白ににちよさんが座る） ─ */}
                {visibleAboutItems.length > 0 && (
                  <>
                    <MenuDivider />
                    <div className="flex items-end">
                      <div className="min-w-0 flex-1">
                        {visibleAboutItems.map((item) => (
                          <MenuRow
                            key={item.href}
                            icon={item.icon}
                            label={item.label}
                            muted
                            onClick={() => handleMenuItemClick(item.href)}
                          />
                        ))}
                      </div>
                      <MenuGrandma />
                    </div>
                  </>
                )}

                {/* ─ 出店者メニュー ─ */}
                {(permissions.isVendor || permissions.isAdmin) && visibleVendorItems.length > 0 && (
                  <>
                    <MenuDivider label="出店者" />
                    {visibleVendorItems.map((item) => (
                      <MenuRow
                        key={item.href}
                        icon={item.icon}
                        label={item.label}
                        onClick={() => handleMenuItemClick(item.href)}
                      />
                    ))}
                  </>
                )}

                {/* ─ 管理メニュー ─ */}
                {permissions.isAdmin && (
                  <>
                    <MenuDivider label="管理者" />
                    {adminMenuItems.map((item) => (
                      <MenuRow
                        key={item.href}
                        icon={item.icon}
                        label={item.label}
                        onClick={() => handleMenuItemClick(item.href)}
                      />
                    ))}
                  </>
                )}

                {/* ─ ログアウト ─ */}
                {isLoggedIn && (
                  <>
                    <MenuDivider />
                    <MenuRow icon={LogOut} label="ログアウト" muted onClick={handleLogout} />
                  </>
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
            : "border-slate-200/60 bg-white/90 backdrop-blur-md"
        }`}
        style={{ paddingBottom: "var(--safe-bottom, 0px)" }}
      >
        {isHome ? (
          /* ── マップ：フルナビ ── */
          <div className="mx-auto flex h-14 max-w-lg items-center">
            {/* 左：相談（ページ公開設定で非表示のときはレイアウト維持のため空枠にする） */}
            {!isConsultVisible ? (
              <div className="flex-1" aria-hidden />
            ) : onConsultClick ? (
              <button
                type="button"
                onClick={onConsultClick}
                className="group flex h-full flex-1 flex-col items-center justify-center gap-1 text-slate-400 transition-colors duration-200 hover:text-slate-600"
              >
                <consultItem.icon
                  className="h-[22px] w-[22px] transition-transform duration-200 group-hover:scale-105 group-active:scale-95"
                  strokeWidth={1.7}
                  aria-hidden
                />
                <span className="text-[10px] font-medium leading-none tracking-tight">
                  {consultItem.name}
                </span>
              </button>
            ) : (
              <NavLinkItem
                item={consultItem}
                isActive={(activeHref ?? pathname) === consultItem.href}
              />
            )}

            {/* 中央：メニューボタン */}
            <div className="flex flex-1 items-center justify-center">
              <button
                ref={menuButtonRef}
                type="button"
                onClick={toggleMenu}
                aria-expanded={menuOpen}
                aria-haspopup="dialog"
                aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
                className="flex flex-col items-center gap-1"
              >
                <motion.span
                  animate={{ scale: menuOpen ? 1.06 : 1 }}
                  whileTap={{ scale: 0.94 }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring", damping: 24, stiffness: 420 }
                  }
                  className="relative flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white shadow-[0_6px_16px_-4px_rgba(15,23,42,0.5)]"
                >
                  {/* 開閉でアイコンを重ねて入れ替える（回転だけだと格子も×も見た目が変わらない） */}
                  <motion.span
                    className="absolute inset-0 flex items-center justify-center"
                    animate={{ opacity: menuOpen ? 0 : 1, scale: menuOpen ? 0.7 : 1 }}
                    transition={fadeTransition}
                  >
                    <LayoutGrid className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden />
                  </motion.span>
                  <motion.span
                    className="absolute inset-0 flex items-center justify-center"
                    animate={{ opacity: menuOpen ? 1 : 0, scale: menuOpen ? 1 : 0.7 }}
                    transition={fadeTransition}
                  >
                    <X className="h-[21px] w-[21px]" strokeWidth={2.2} aria-hidden />
                  </motion.span>
                </motion.span>
                <span className="text-[10px] font-medium leading-none tracking-tight text-slate-500">
                  メニュー
                </span>
              </button>
            </div>

            {/* 右：近況（+ 管理タブがあれば追加）。全部非表示なら空枠で中央のメニュー位置を維持 */}
            {rightNavItems.length === 0 ? (
              <div className="flex-1" aria-hidden />
            ) : (
              rightNavItems.map((item) => (
                <NavLinkItem
                  key={item.href}
                  item={item}
                  isActive={(activeHref ?? pathname) === item.href}
                />
              ))
            )}
          </div>
        ) : isCloseUxActive ? (
          /* ── パネル表示中：緑バー × ── */
          <div className="mx-auto flex h-14 max-w-lg items-center justify-center">
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                <X className="h-5 w-5 text-white" strokeWidth={2.4} aria-hidden />
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
              onClick={goToMap}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition active:scale-95 hover:bg-slate-100"
            >
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
              マップにもどる
            </button>
          </div>
        )}
      </nav>
    </>
  );
}

// ─── シートの部品 ─────────────────────────────────────────────────────────────
/** メニューの1行。アイコン・字送り・高さを全項目で揃える */
function MenuRow({
  icon: Icon,
  label,
  muted = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  /** 補助的な項目。少し小さく、控えめな色にする */
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-2xl px-3 text-left transition active:bg-nicchyo-ink/[0.05]"
    >
      <Icon
        className={`shrink-0 ${muted ? "h-[19px] w-[19px] text-nicchyo-ink/35" : "h-[21px] w-[21px] text-nicchyo-ink/55"}`}
        strokeWidth={1.7}
        aria-hidden
      />
      <span
        className={
          muted
            ? "flex-1 py-2.5 text-[14px] font-medium text-nicchyo-ink/70"
            : "flex-1 py-3 text-[15px] font-semibold text-nicchyo-ink"
        }
      >
        {label}
      </span>
    </button>
  );
}

/** 区切り線。見出しを添えるときは線の代わりに小さな文字を置く */
function MenuDivider({ label }: { label?: string }) {
  if (label) {
    return (
      <p className="mb-1 mt-4 px-3 text-[11px] font-semibold tracking-wide text-nicchyo-ink/40">{label}</p>
    );
  }
  return <div className="my-2 h-px bg-nicchyo-ink/[0.08]" />;
}

// ─── NavLinkItem ──────────────────────────────────────────────────────────────
function NavLinkItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch={false}
      className={`group flex h-full flex-1 flex-col items-center justify-center gap-1 transition-colors duration-200 ${
        isActive ? "text-amber-600" : "text-slate-400 hover:text-slate-600"
      }`}
    >
      <Icon
        className={`h-[22px] w-[22px] transition-transform duration-200 group-active:scale-95 ${
          isActive ? "scale-105" : "group-hover:scale-105"
        }`}
        strokeWidth={isActive ? 2 : 1.7}
        aria-hidden
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
