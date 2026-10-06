"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useCallback, useId, useRef, useState, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  CalendarDays,
  CircleHelp,
  Compass,
  FileText,
  Heart,
  HeartHandshake,
  Info,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  Sparkles,
  ShieldCheck,
  MessageCircle,
  Newspaper,
  Settings,
  Store,
  Users,
  X,
  type LucideIcon,
  Github,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { GITHUB_REPO_URL } from "@/lib/siteLinks";
import { useMenu } from "@/lib/ui/MenuContext";
import { usePageVisibility } from "@/lib/pageVisibility/PageVisibilityContext";
import { ODEKAKE_VISIBILITY_PATH } from "@/lib/pageVisibility/registry";
import { useMapLoading } from "./MapLoadingProvider";
import MenuGrandma from "./MenuGrandma";
import {
  BottomNavBackBar,
  BottomNavItemContent,
  BottomNavLink,
  bottomNavItemClass,
  MenuDivider,
  MenuRow,
  MenuSheet,
  MenuToggleButton,
  MenuUserRow,
} from "@/components/navigation/MenuSheet";

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

/** 近況のデモ。近況と両方公開しているときは、ナビの「近況」を押すとどちらへ行くか選べる */
const STORY_DEMO_HREF = "/demo/story";

/** 近況ボタンを押したときに出す行き先。上から順に並べる */
const STORY_CHOICES = [
  { href: "/story", label: "近況", description: "出店者の投稿" },
  { href: STORY_DEMO_HREF, label: "近況（デモ）", description: "見本の投稿と店のAIキャラ" },
] as const;

// ─── メニューの項目 ───────────────────────────────────────────────────────────
// 絵文字は端末ごとに絵柄が変わって揃わないので、線の太さを合わせたアイコンを使う。
type SheetItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** 開発中であることなど、開く前に伝えておきたい一言（例: デモ） */
  badge?: string;
  /** 公開設定を見るキー。省略時は href のパス部分 */
  visibilityPath?: string;
};

/** 日曜市を歩くときに使うページ */
const visitMenuItems: SheetItem[] = [
  { label: "お気に入り", href: "/favorites", icon: Heart },
  // 地図の上で種類を選ぶ画面を直接開く（/facilities のページは廃止し、ここへ送るだけにした）。
  // 行き先は常に公開の /map なので、表示の可否は「おでかけサポート」の設定で決める
  { label: "おでかけサポート", href: "/map?guide=menu", icon: Compass, visibilityPath: ODEKAKE_VISIBILITY_PATH },
  { label: "日曜市カレンダー", href: "/calendar", icon: CalendarDays },
  // 中身がまだサンプル値なので、開く前に分かるようにしておく
  { label: "日曜市をデータで見る", href: "/analysis", icon: BarChart3, badge: "デモ" },
];

/** 地図の上に重なるだけで、ナビの状態を変えない ?panel= の値 */
const HOME_PANEL_VALUES = new Set(["intro"]);

/** nicchyo そのものについてのページ */
const aboutMenuItems: SheetItem[] = [
  // 初回だけ自動で出る案内パネルを、あとから読み直すための入口。
  // ページではなく地図の上に開くので、行き先は /map のパラメータになる
  { label: "はじめての方へ", href: "/map?panel=intro", icon: Sparkles },
  { label: "nicchyoとは", href: "/about", icon: Info },
  { label: "協賛・ご支援について", href: "/support", icon: HeartHandshake },
  { label: "よくある質問", href: "/faq", icon: CircleHelp },
  { label: "お問い合わせ", href: "/contact", icon: Mail },
  { label: "プライバシーポリシー", href: "/privacy", icon: ShieldCheck },
];

// ─── 出店者・管理者メニュー ────────────────────────────────────────────────────
// 出店者の機能はすべて出店者ページ（/my-shop）からたどれるので、ここは入口の1つだけにする
const vendorHomeItem: SheetItem = { label: "出店者ページ", href: "/my-shop", icon: Store };

const adminMenuItems: SheetItem[] = [
  { label: "管理ダッシュボード", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "ユーザー管理", href: "/admin/users", icon: Users },
  { label: "コンテンツ管理", href: "/admin/content", icon: FileText },
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
  const { isMenuOpen: menuOpen, toggleMenu, closeMenu } = useMenu();
  const { isLinkVisible } = usePageVisibility();
  const { startMapLoading } = useMapLoading();
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    onMenuOpenChange?.(menuOpen);
  }, [menuOpen, onMenuOpenChange]);

  const panel = searchParams?.get("panel");
  const isRoleConsoleArea =
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/vendor") ||
    pathname?.startsWith("/moderator");
  // 画面を覆って「閉じる」が要るのは検索パネルだけ。
  // ?panel=intro（はじめての方への案内）は地図の上に重なるだけで自前の閉じ方を持つので、
  // ナビまで閉じるモードにしない
  const isPanelOpen = pathname === "/map" && panel === "search";
  const isCloseUxActive = isPanelOpen || closeModeActive;
  /*
   * 地図に「居る」とみなす ?panel= の値の許可リスト。
   * 案内（intro）は地図の上に重なるだけなので、ナビはふつうの地図の状態のまま。
   * ここに無い値が付いているときは地図ではない扱いにして、新しいパネルを足したとき
   * 黙ってフルナビ表示に倒れないようにする（検索は上の isCloseUxActive が閉じるモードにする）
   */
  const isHome =
    (activeHref ?? pathname) === "/map" &&
    !isCloseUxActive &&
    (!panel || HOME_PANEL_VALUES.has(panel));

  // 「今いるページ」の判定は遷移先（target）で行う。
  // 相談は href が /map（マップ上では onConsultClick で /consult へ送る）なので、
  // href で比べるとマップにいるだけで相談が点いてしまう。
  const currentHref = activeHref ?? pathname;
  const isNavItemActive = (item: NavItem) => currentHref === (item.target ?? item.href);

  /*
   * 地図の上にいる間（ふつうの地図・検索パネル表示中）のナビ。
   * lg 以上（PC・ノートPC）では画面の端から端までの帯ではなく、下端中央に浮かぶ
   * 小さな丸いバーにして、広い地図を隠さないようにする。
   * スマホと、サブページのもどるバーは従来どおり全幅の帯のまま
   */
  const isMapNav = isHome || isCloseUxActive;

  // ページ公開設定で public でないリンクはナビに出さない
  const consultItem = baseNavItems[0];
  const isConsultVisible = isLinkVisible(consultItem.target ?? consultItem.href);
  // 近況ボタンの行き先。近況と近況（デモ）の両方が公開のとき、モデレーター以上は押すと
  // どちらへ行くかを選べる。公開設定で片方だけにすれば、誰が押してもすぐそちらへ行く
  const storyItem = baseNavItems[1];
  const storyHrefs = [storyItem.href, STORY_DEMO_HREF].filter((href) => isLinkVisible(href));
  // 見比べるための選択メニューは開発メンバー（モデレーター以上）にだけ出す。来訪者には、
  // 本番の公開設定を触り忘れても開発用のメニューが出ないよう、公開されている先頭（近況が
  // 公開なら近況、そうでなければデモ）へ直接行かせる
  const showStoryChooser = storyHrefs.length === 2 && permissions.isModerator;
  const storyNavItem: NavItem | null =
    storyHrefs.length > 0 && !showStoryChooser ? { ...storyItem, href: storyHrefs[0] } : null;
  const adminNavItems: NavItem[] = permissions.isAdmin
    ? [{ name: "管理", href: "/admin/dashboard", icon: Settings }]
    : [];
  const rightNavItems = [
    ...(storyNavItem ? [storyNavItem] : []),
    ...adminNavItems.filter((item) => isLinkVisible(item.href)),
  ];
  // 公開設定はパス単位なので、/map?guide=menu のようなクエリは外して判定する
  const visibleVisitItems = visitMenuItems.filter((item) =>
    isLinkVisible(item.visibilityPath ?? item.href.split("?")[0])
  );
  const visibleAboutItems = aboutMenuItems.filter((item) =>
    isLinkVisible(item.visibilityPath ?? item.href.split("?")[0])
  );
  const showVendorHome = permissions.isVendor && isLinkVisible(vendorHomeItem.href);

  // router.push はリンクと違って Provider のクリック監視に掛からないので、/map へ向かう前に自分で始める
  const goToMap = useCallback(() => {
    startMapLoading();
    router.push("/map");
  }, [router, startMapLoading]);

  const handleMenuItemClick = (href: string) => {
    closeMenu();
    if (href === "/map") { goToMap(); return; }
    // /map?guide=menu（おでかけサポート）のようにクエリ付きで地図へ向かう項目も、
    // 地図の読み込み表示を先に始めてから移る
    if (href.startsWith("/map?")) { startMapLoading(); }
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

  const roleLabel = permissions.isAdmin
    ? "管理者"
    : permissions.isModerator
    ? "モデレーター"
    : permissions.isVendor
    ? "出店者"
    : null;

  if (isRoleConsoleArea) return null;

  return (
    <>
      {/* ── ボトムメニューシート ────────────────────────────────────────────── */}
      <MenuSheet open={menuOpen} onClose={closeMenu} label="メニュー" returnFocusRef={menuButtonRef}>
        {/* ─ ユーザー ─ */}
        {isLoggedIn && user ? (
          <MenuUserRow
            name={user.name}
            avatarUrl={user.avatarUrl}
            roleLabel={roleLabel}
            onClick={() => handleMenuItemClick("/my-profile")}
          />
        ) : (
          <MenuRow
            icon={LogIn}
            label="ログイン / 登録"
            onClick={() => handleMenuItemClick("/login")}
          />
        )}

        {/* ─ 出店者ページへの入口。出店者がいちばんよく使うので、来訪者向けの項目より上に置く ─ */}
        {showVendorHome && (
          <>
            <MenuDivider label="出店者" />
            <MenuRow
              icon={vendorHomeItem.icon}
              label={vendorHomeItem.label}
              onClick={() => handleMenuItemClick(vendorHomeItem.href)}
            />
          </>
        )}

        <MenuDivider />

        {/* ─ 日曜市を歩くためのページ ─ */}
        {visibleVisitItems.map((item) => (
          <MenuRow
            key={item.href}
            icon={item.icon}
            label={item.label}
            badge={item.badge}
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
                    badge={item.badge}
                    muted
                    onClick={() => handleMenuItemClick(item.href)}
                  />
                ))}
              </div>
              <MenuGrandma />
            </div>
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
                badge={item.badge}
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

        {/* ─ 末尾の小さなリンク。来訪者向けの項目と並べず、フッターとして置く ─ */}
        <MenuDivider />
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold tracking-wide text-nicchyo-ink/40 transition hover:text-nicchyo-ink/70"
        >
          <Github className="h-3.5 w-3.5" aria-hidden />
          オープンソースで開発しています（GitHub）
        </a>
      </MenuSheet>

      {/* ── ナビゲーションバー ──────────────────────────────────────────────── */}
      <nav
        onClick={isCloseUxActive ? handleCloseMode : undefined}
        className={`navigation-bar ${position} bottom-0 left-0 right-0 z-[9997] border-t text-sm leading-none shadow-sm transition-colors duration-300 ${
          isCloseUxActive
            ? "cursor-pointer border-green-500 bg-green-500"
            : "border-slate-200/60 bg-white/90 backdrop-blur-md"
        } ${
          isMapNav
            ? "lg:bottom-4 lg:left-1/2 lg:right-auto lg:w-[22rem] lg:-translate-x-1/2 lg:rounded-full lg:border lg:shadow-float"
            : ""
        }`}
        style={{ paddingBottom: "var(--safe-bottom, 0px)" }}
      >
        {isHome ? (
          /* ── マップ：フルナビ ── */
          <div className="mx-auto flex h-14 max-w-lg items-center lg:h-16">
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
              <NavLinkItem item={consultItem} isActive={isNavItemActive(consultItem)} />
            )}

            {/* 中央：メニューボタン */}
            <MenuToggleButton open={menuOpen} onClick={toggleMenu} buttonRef={menuButtonRef} />

            {/* 右：近況（+ 管理タブがあれば追加）。全部非表示なら空枠で中央のメニュー位置を維持 */}
            {rightNavItems.length === 0 && !showStoryChooser ? (
              <div className="flex-1" aria-hidden />
            ) : (
              <>
                {showStoryChooser && (
                  <StoryNavChooser
                    item={storyItem}
                    isActive={currentHref === storyItem.href || currentHref === STORY_DEMO_HREF}
                  />
                )}
                {rightNavItems.map((item) => (
                  <NavLinkItem key={item.href} item={item} isActive={isNavItemActive(item)} />
                ))}
              </>
            )}
          </div>
        ) : isCloseUxActive ? (
          /* ── パネル表示中：緑バー × ── */
          <div className="mx-auto flex h-14 max-w-lg items-center justify-center lg:h-16">
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
          <BottomNavBackBar label="マップにもどる" onClick={goToMap} />
        )}
      </nav>
    </>
  );
}

// ─── NavLinkItem ──────────────────────────────────────────────────────────────
function NavLinkItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return <BottomNavLink href={item.href} label={item.name} icon={item.icon} isActive={isActive} />;
}

/**
 * 近況ボタン（開発中用）。押すと上に小さなメニューが開き、近況と近況（デモ）のどちらへ
 * 行くかを選ぶ。外側を押すか Esc で閉じる。
 */
function StoryNavChooser({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // 矢印キーで動く menu ではなく、ただのリンク2つなので、開閉ボタンと一覧を aria-controls でつなぐだけにする
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex h-full flex-1">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={bottomNavItemClass(isActive || open)}
      >
        <BottomNavItemContent icon={item.icon} label={item.name} isActive={isActive || open} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={listId}
            role="group"
            aria-label="近況の行き先"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-2 mb-2 w-56 rounded-panel bg-white p-1.5 shadow-float ring-1 ring-line"
          >
            {STORY_CHOICES.map((choice) => (
              <Link
                key={choice.href}
                href={choice.href}
                prefetch={false}
                onClick={() => setOpen(false)}
                className="block rounded-btn px-3 py-2.5 text-left transition hover:bg-nicchyo-ink/5 active:bg-nicchyo-ink/10"
              >
                <span className="block text-sm font-bold leading-tight text-nicchyo-ink">{choice.label}</span>
                <span className="mt-0.5 block text-[11px] leading-tight text-nicchyo-ink/55">
                  {choice.description}
                </span>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function NavigationBar(props: NavigationBarProps) {
  return (
    <Suspense>
      <NavigationBarInner {...props} />
    </Suspense>
  );
}
