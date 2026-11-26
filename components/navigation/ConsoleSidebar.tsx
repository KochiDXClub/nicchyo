"use client";

/**
 * 管理画面と出店者ページの、PC で左に固定するサイドバー。
 *
 * 【設計方針】
 * - 管理画面（AdminSidebar）と出店者ページ（VendorSidebar）が同じ見た目・同じ並びになるよう、
 *   外枠・見出し・グループ・1行の項目・フッターをここにまとめる。片方だけ直して見た目が
 *   ずれていかないよう、変えるときはここを直す。
 * - 項目はそれぞれの単一情報源（lib/admin/adminNav.ts・components/vendor/vendorNavItems.ts）から
 *   呼び出し側が組み立てて渡す。ここに項目を直接書かない。
 * - アイコンは lucide-react のライン系で統一する（絵文字は使わない）。
 * - 配色はニュートラルを基調にし、呼び出し側の色（accent）は選択中インジケーターだけに使う。
 */

import React, { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { Home, Menu, PanelLeftClose, X, type LucideIcon } from "lucide-react";
import { NicchyoLogo, NicchyoLogoLink } from "./NicchyoLogoLink";

/** サイドバーのぶん、本文を右へ寄せる余白。サイドバーの幅（w-[248px]）と揃える */
export const CONSOLE_SIDEBAR_OFFSET_CLASS = "lg:pl-[248px]";

/** アイコンだけのレール（collapsible）のときの余白。レールの幅（w-14）と揃える。展開時は本文の上に重ねる */
export const CONSOLE_SIDEBAR_RAIL_OFFSET_CLASS = "lg:pl-14";

/** アイコン列とサブ一覧（幅 w-56）のぶん、本文を右へ寄せる余白 */
export const CONSOLE_SIDEBAR_RAIL_WITH_PANEL_OFFSET_CLASS = "lg:pl-[280px]";

/** サブ一覧の左端（PC）。サブ一覧を出すページの下部バーなどを、本文と同じ位置に合わせる */
export const CONSOLE_SIDEBAR_PANEL_LEFT_CLASS = "lg:left-[280px]";

/** 呼び出し側の色。サイドバーは面で色を塗らないので、線と文字だけの控えめな指定にする */
export type ConsoleSidebarAccent = {
  /** 選択中の項目の左に出す縦線 */
  bar: string;
  /** 選択中の項目のアイコン */
  icon: string;
  /** フッターの役割名の前に出す点 */
  dot: string;
};

export type ConsoleSidebarItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** ホバーで出す一行説明 */
  description?: string;
  isActive: boolean;
  /** 右端に添えるもの（新着の件数など） */
  trailing?: ReactNode;
};

/** PC の左端のアイコン列に出すメイン。アイコンだけを出し、カーソルを重ねた時だけ名前が広がる */
export type ConsoleSidebarRailItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  isActive: boolean;
  /** 右上に添えるもの（配下の未対応の件数など） */
  trailing?: ReactNode;
};

export type ConsoleSidebarGroup = {
  id: string;
  /** グループ見出し */
  label: string;
  items: ConsoleSidebarItem[];
};

/**
 * フッターに2つ並べる操作。href ならリンク（押すとサイドバーを閉じる）、onClick ならボタンにする。
 * ボタンのときは、サイドバーを閉じるかどうかを onClick の中で決める（ログアウトなど、閉じてから処理したいものがあるため）
 */
export type ConsoleSidebarAction = {
  label: string;
  icon: LucideIcon;
} & ({ href: string; onClick?: never } | { onClick: () => void; href?: never });

/**
 * メニューのスクロール位置（menuLabel ごと）。
 * 管理画面は各ページが自分で AdminLayout を描くため、ページを移るとサイドバーが作り直され、
 * 何もしないと下の方の項目を押すたびにメニューが一番上へ戻ってしまう。モジュールに持っておき、作り直したときに戻す
 */
const navScrollTopByMenu = new Map<string, number>();

/** サーバー描画では useLayoutEffect が警告を出すので、ブラウザでだけ使う（描画前に戻して、一瞬上に戻るちらつきを出さない） */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const FOOTER_ACTION_CLASS =
  "flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line text-[12px] font-medium text-nicchyo-ink/70 transition hover:bg-nicchyo-ink/5 hover:text-nicchyo-ink";

/**
 * collapsible（PC のアイコンだけのレール）のときの見た目。
 * 外枠の group/rail に乗せ、カーソルを重ねた時（またはキーボードでフォーカスした時）だけ文字を出す。
 * 文字は隠すだけで DOM には残すので、読み上げと title はそのまま働く。
 * 展開は本文の上に重なる（本文の余白はレールの幅のまま動かない）。
 */
/**
 * 展開・収納のなめらかな動き（Supabase に近づける）。文字は幅と透明度を、件数は位置を、
 * 選択中の縦線は透明度を、それぞれ 200ms で動かす。ホバー・フォーカスが外れたら同じ速さで戻す。
 * 動きは motion-reduce のときは止める。
 */
const RAIL_MOTION = "lg:transition-[max-width,max-height,opacity,padding,left,right] lg:duration-200 lg:ease-out motion-reduce:transition-none";
const RAIL_REVEAL = "lg:max-w-0 lg:overflow-hidden lg:opacity-0 lg:group-hover/rail:max-w-[200px] lg:group-hover/rail:opacity-100 lg:group-focus-within/rail:max-w-[200px] lg:group-focus-within/rail:opacity-100";
const RAIL = {
  // スマホ（lg 未満）は基本の 248px。PC だけアイコン列の幅にする
  aside: "w-[248px] lg:w-14 lg:hover:w-[248px] lg:focus-within:w-[248px] lg:hover:shadow-float lg:focus-within:shadow-float",
  header: "lg:px-2 lg:group-hover/rail:px-4 lg:group-focus-within/rail:px-4",
  nav: "lg:px-2 lg:group-hover/rail:px-3 lg:group-focus-within/rail:px-3",
  groupLabel: `${RAIL_MOTION} lg:max-h-0 lg:pb-0 lg:overflow-hidden lg:opacity-0 lg:group-hover/rail:max-h-6 lg:group-hover/rail:pb-1.5 lg:group-hover/rail:opacity-100 lg:group-focus-within/rail:max-h-6 lg:group-focus-within/rail:pb-1.5 lg:group-focus-within/rail:opacity-100`,
  itemLabel: `${RAIL_MOTION} ${RAIL_REVEAL}`,
  // 件数はレールではアイコンの右上に置き、展開すると項目の右端へ滑らせる
  itemTrailing: `${RAIL_MOTION} lg:absolute lg:left-[18px] lg:right-auto lg:top-1/2 lg:-translate-y-1/2 lg:group-hover/rail:left-auto lg:group-hover/rail:right-2.5 lg:group-focus-within/rail:left-auto lg:group-focus-within/rail:right-2.5`,
  // 選択中の縦線：レールでは出さず、展開したときだけフェードで出す
  activeBar: `${RAIL_MOTION} lg:opacity-0 lg:group-hover/rail:opacity-100 lg:group-focus-within/rail:opacity-100`,
  footer: "lg:p-2 lg:group-hover/rail:p-3 lg:group-focus-within/rail:p-3",
  userRow: "lg:justify-center lg:px-0 lg:group-hover/rail:justify-start lg:group-hover/rail:px-2 lg:group-focus-within/rail:justify-start lg:group-focus-within/rail:px-2",
  userText: `${RAIL_MOTION} ${RAIL_REVEAL}`,
  actions: `${RAIL_MOTION} lg:grid-cols-1 lg:group-hover/rail:grid-cols-2 lg:group-focus-within/rail:grid-cols-2`,
  actionText: `${RAIL_MOTION} ${RAIL_REVEAL}`,
} as const;

export const ConsoleSidebar = React.memo(function ConsoleSidebar({
  isOpen,
  onToggle,
  onClose,
  menuLabel,
  showMobileToggle = true,
  collapsible = false,
  rail,
  subPanel,
  homeHref,
  homeLabel,
  subtitle,
  groups,
  accent,
  userName,
  roleLabel,
  actions,
}: {
  isOpen: boolean;
  onToggle?: () => void;
  onClose: () => void;
  /** 読み上げ用のメニューの名前（「管理メニュー」など） */
  menuLabel: string;
  /** スマホで左上に開閉ボタンを出すか。下部バーで代わりの導線を出す画面では false */
  showMobileToggle?: boolean;
  /**
   * PC ではアイコンだけのレールにし、カーソル（フォーカス）を重ねた時だけ項目名を広げる（Supabase 風）。
   * 本文の余白は CONSOLE_SIDEBAR_RAIL_OFFSET_CLASS にそろえる。出店者・市の画面は従来どおり（false）
   */
  collapsible?: boolean;
  /**
   * PC の左端のアイコン列（メイン）。指定すると PC はこの列だけを出し、groups はモバイルの開閉メニューに回す。
   * collapsible と一緒に使う
   */
  rail?: ConsoleSidebarRailItem[];
  /** PC で、選んだメインのサブ一覧を常に出す（アイコン列の右隣）。サブが無いメインは null */
  subPanel?: { label: string; items: ConsoleSidebarItem[] } | null;
  /** ロゴから戻る、この画面のホーム */
  homeHref: string;
  homeLabel: string;
  subtitle: string;
  groups: ConsoleSidebarGroup[];
  accent: ConsoleSidebarAccent;
  userName: string;
  roleLabel: string;
  actions: [ConsoleSidebarAction, ConsoleSidebarAction];
}) {
  const initial = userName.slice(0, 1);
  const navRef = useRef<HTMLElement>(null);

  // 作り直されたときにスクロール位置を戻す。覚えていない（読み込み直したとき）なら、選択中の項目が見えるところまで送る
  useIsomorphicLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const saved = navScrollTopByMenu.get(menuLabel);
    if (saved !== undefined) {
      nav.scrollTop = saved;
      return;
    }
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) return;
    const overflow = active.getBoundingClientRect().bottom - nav.getBoundingClientRect().bottom;
    if (overflow > 0) nav.scrollTop += overflow;
  }, [menuLabel]);

  /** 一覧の1行。plain のときは PC の折りたたみ用の装飾を付けない（サブ一覧は常に文字を出す） */
  const renderNavItem = (item: ConsoleSidebarItem, plain: boolean) => {
    const Icon = item.icon;
    const folded = collapsible && !plain && !rail;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onClose}
          title={item.description}
          aria-current={item.isActive ? "page" : undefined}
          className={`group relative flex h-9 items-center gap-2.5 rounded-lg ${
            collapsible && !plain ? "px-2" : "px-2.5"
          } text-[13px] font-medium transition-colors ${
            item.isActive
              ? "bg-nicchyo-ink/5 text-nicchyo-ink"
              : "text-nicchyo-ink/70 hover:bg-nicchyo-ink/5 hover:text-nicchyo-ink"
          }`}
        >
          {item.isActive && (
            <span
              className={`absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full ${accent.bar} ${
                folded ? RAIL.activeBar : ""
              }`}
              aria-hidden="true"
            />
          )}
          <Icon
            className={`h-[16px] w-[16px] shrink-0 transition-colors ${
              item.isActive ? accent.icon : "text-nicchyo-ink/40 group-hover:text-nicchyo-ink/55"
            }`}
            aria-hidden="true"
          />
          <span className={`min-w-0 flex-1 truncate ${folded ? RAIL.itemLabel : ""}`}>{item.label}</span>
          {item.trailing != null && (
            // レールでは未対応の件数をアイコンの右上に小さく出す（展開したら項目の右端へ戻す）
            <span className={`ml-auto ${folded ? RAIL.itemTrailing : ""}`}>{item.trailing}</span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <>
      {rail && (
        // 全幅のヘッダー。サイドバーを開いても閉じても、ここにロゴが常に見える（モバイルの開閉ボタンの右に置く）
        <header className="fixed inset-x-0 top-0 z-[10000] flex h-14 items-center border-b border-line bg-white pl-16 pr-4 lg:pl-4">
          <NicchyoLogoLink href={homeHref} label={homeLabel} onClick={onClose} />
        </header>
      )}
      {/* モバイル用の開閉ボタン */}
      {showMobileToggle && (
        <button
          type="button"
          onClick={onToggle ?? onClose}
          className={`fixed z-[10010] flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white/90 text-nicchyo-ink/70 shadow-chip backdrop-blur transition hover:bg-white active:scale-95 lg:hidden ${
            isOpen ? "left-[192px] top-2" : "left-4 top-4"
          }`}
          aria-expanded={isOpen}
          aria-label={isOpen ? `${menuLabel}を閉じる` : `${menuLabel}を開く`}
        >
          {isOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
        </button>
      )}

      {isOpen && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-[9998] bg-nicchyo-ink/40 backdrop-blur-[2px] lg:hidden"
          aria-label="サイドバーを閉じる"
        />
      )}

      <aside
        className={`group/rail fixed ${rail ? "top-14 bottom-0" : "inset-y-0"} left-0 z-[9999] flex ${
          collapsible ? RAIL.aside : "w-[248px]"
        } flex-col border-r border-line bg-white motion-safe:transition-[transform,visibility,width,box-shadow] motion-safe:duration-200 ease-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "invisible -translate-x-full lg:visible"
        }`}
      >
        {/* ヘッダー：PC のレールでは、ロゴは上の全幅ヘッダーに出し、ここはこの列の見出しだけ */}
        {rail ? (
          <div className={`flex h-14 shrink-0 items-center border-b border-line px-4 ${RAIL.header}`}>
            <span className={`min-w-0 flex-1 truncate text-xs text-nicchyo-ink/70 ${RAIL.itemLabel}`}>{subtitle}</span>
          </div>
        ) : (
        <div className={`flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4 ${collapsible ? RAIL.header : ""}`}>
          {collapsible ? (
            // レールでは1つのリンクにまとめる（ホームのアイコン⇄ロゴを、展開に合わせて切り替える）
            <Link
              href={homeHref}
              aria-label={homeLabel}
              title={homeLabel}
              onClick={onClose}
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg text-nicchyo-ink/70 transition hover:text-nicchyo-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-nicchyo-primary lg:w-10 lg:justify-center lg:group-hover/rail:w-auto lg:group-hover/rail:justify-start lg:group-focus-within/rail:w-auto lg:group-focus-within/rail:justify-start"
            >
              <Home className="hidden h-[18px] w-[18px] lg:block lg:group-hover/rail:hidden lg:group-focus-within/rail:hidden" aria-hidden="true" />
              <span className="inline-flex lg:hidden lg:group-hover/rail:inline-flex lg:group-focus-within/rail:inline-flex">
                <NicchyoLogo alt="" />
              </span>
            </Link>
          ) : (
            <NicchyoLogoLink href={homeHref} label={homeLabel} onClick={onClose} />
          )}
          <span
            className={`min-w-0 flex-1 truncate text-xs text-nicchyo-ink/70 ${collapsible ? RAIL.itemLabel : ""}`}
          >
            {subtitle}
          </span>
          {showMobileToggle ? (
            <span className="w-10 shrink-0 lg:hidden" aria-hidden />
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-nicchyo-ink/55 transition hover:bg-nicchyo-ink/5 hover:text-nicchyo-ink/70 lg:hidden"
              aria-label="サイドバーを閉じる"
            >
              <PanelLeftClose className="h-[16px] w-[16px]" />
            </button>
          )}
        </div>

        )}

        {/* ナビゲーション */}
        <nav
          ref={navRef}
          aria-label={menuLabel}
          onScroll={(e) => navScrollTopByMenu.set(menuLabel, e.currentTarget.scrollTop)}
          className={`flex-1 overflow-y-auto px-3 py-4 ${collapsible ? RAIL.nav : ""}`}>
          {rail && (
            // PC：左のアイコン列（メイン）。モバイルでは出さず、下の一覧を使う
            <ul className="hidden space-y-1 lg:block">
              {rail.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      title={item.label}
                      aria-current={item.isActive ? "page" : undefined}
                      className={`group relative flex h-10 items-center gap-2.5 rounded-lg px-2 text-[13px] font-medium transition-colors ${
                        item.isActive
                          ? "bg-nicchyo-ink/5 text-nicchyo-ink"
                          : "text-nicchyo-ink/70 hover:bg-nicchyo-ink/5 hover:text-nicchyo-ink"
                      }`}
                    >
                      {item.isActive && (
                        <span
                          className={`absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full ${accent.bar} ${RAIL.activeBar}`}
                          aria-hidden="true"
                        />
                      )}
                      <Icon
                        className={`h-[16px] w-[16px] shrink-0 transition-colors ${
                          item.isActive ? accent.icon : "text-nicchyo-ink/40 group-hover:text-nicchyo-ink/55"
                        }`}
                        aria-hidden="true"
                      />
                      <span className={`min-w-0 flex-1 truncate ${RAIL.itemLabel}`}>{item.label}</span>
                      {item.trailing != null && <span className={RAIL.itemTrailing}>{item.trailing}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <div className={`space-y-5 ${rail ? "lg:hidden" : ""}`}>
            {groups.map((group) => (
              <div key={group.id}>
                <p
                  className={`px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-nicchyo-ink/55 ${
                    collapsible && !rail ? RAIL.groupLabel : ""
                  }`}
                >
                  {group.label}
                </p>
                <ul className="space-y-0.5">{group.items.map((item) => renderNavItem(item, false))}</ul>
              </div>
            ))}
          </div>
        </nav>

        {/* フッター：ユーザー情報と操作 */}
        <div className={`shrink-0 border-t border-line p-3 ${collapsible ? RAIL.footer : ""}`}>
          <div className={`flex items-center gap-2.5 rounded-lg px-2 py-2 ${collapsible ? RAIL.userRow : ""}`}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-nicchyo-ink/5 text-[13px] font-semibold uppercase text-nicchyo-ink/70">
              {initial}
            </span>
            <span className={`min-w-0 flex-1 leading-tight ${collapsible ? RAIL.userText : ""}`}>
              <span className="block truncate text-[13px] font-medium text-nicchyo-ink">{userName}</span>
              <span className="flex items-center gap-1.5 text-[11px] text-nicchyo-ink/55">
                <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} aria-hidden="true" />
                {roleLabel}
              </span>
            </span>
          </div>
          <div className={`mt-1 grid grid-cols-2 gap-1.5 ${collapsible ? RAIL.actions : ""}`}>
            {actions.map(({ label, icon: ActionIcon, href, onClick }) => {
              const content = (
                <>
                  <ActionIcon className="h-[14px] w-[14px]" aria-hidden="true" />
                  <span className={collapsible ? RAIL.actionText : undefined}>{label}</span>
                </>
              );
              return href ? (
                <Link key={label} href={href} onClick={onClose} className={FOOTER_ACTION_CLASS}>
                  {content}
                </Link>
              ) : (
                <button key={label} type="button" onClick={onClick} className={FOOTER_ACTION_CLASS}>
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* PC：選んだメインのサブ一覧（アイコン列の右隣に常に出す）。モバイルでは出さない */}
      {subPanel && (
        <aside
          aria-label={`${subPanel.label}のサブメニュー`}
          className="fixed top-14 bottom-0 z-[9998] hidden w-56 flex-col border-r border-line bg-white lg:left-14 lg:flex"
        >
          <div className="flex h-14 shrink-0 items-center border-b border-line px-4">
            <span className="truncate text-[13px] font-semibold text-nicchyo-ink">{subPanel.label}</span>
          </div>
          <nav aria-label={`${subPanel.label}のメニュー`} className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-0.5">{subPanel.items.map((item) => renderNavItem(item, true))}</ul>
          </nav>
        </aside>
      )}
    </>
  );
});
