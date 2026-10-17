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
import { Menu, PanelLeftClose, X, type LucideIcon } from "lucide-react";

/** サイドバーのぶん、本文を右へ寄せる余白。サイドバーの幅（w-[248px]）と揃える */
export const CONSOLE_SIDEBAR_OFFSET_CLASS = "lg:pl-[248px]";

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
  "flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900";

export const ConsoleSidebar = React.memo(function ConsoleSidebar({
  isOpen,
  onToggle,
  onClose,
  menuLabel,
  showMobileToggle = true,
  brandIcon: BrandIcon,
  brandClassName,
  title,
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
  /** 見出しの左に出すアイコン */
  brandIcon: LucideIcon;
  /** 見出しのアイコンの地の色 */
  brandClassName: string;
  title: string;
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

  return (
    <>
      {/* モバイル用の開閉ボタン */}
      {showMobileToggle && (
        <button
          type="button"
          onClick={onToggle ?? onClose}
          className="fixed left-4 top-4 z-[10010] flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition hover:bg-white active:scale-95 lg:hidden"
          aria-label={isOpen ? `${menuLabel}を閉じる` : `${menuLabel}を開く`}
        >
          {isOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
        </button>
      )}

      {isOpen && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-[9998] bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
          aria-label="サイドバーを閉じる"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[9999] flex w-[248px] flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* ヘッダー */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-100 px-4">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white ${brandClassName}`}>
            <BrandIcon className="h-[16px] w-[16px]" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[13px] font-semibold text-slate-900">{title}</span>
            <span className="block truncate text-[11px] text-slate-400">{subtitle}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 lg:hidden"
            aria-label="サイドバーを閉じる"
          >
            <PanelLeftClose className="h-[16px] w-[16px]" />
          </button>
        </div>

        {/* ナビゲーション */}
        <nav
          ref={navRef}
          aria-label={menuLabel}
          onScroll={(e) => navScrollTopByMenu.set(menuLabel, e.currentTarget.scrollTop)}
          className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.id}>
              <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        title={item.description}
                        aria-current={item.isActive ? "page" : undefined}
                        className={`group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors ${
                          item.isActive
                            ? "bg-slate-100 text-slate-900"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        {item.isActive && (
                          <span
                            className={`absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full ${accent.bar}`}
                            aria-hidden="true"
                          />
                        )}
                        <Icon
                          className={`h-[16px] w-[16px] shrink-0 transition-colors ${
                            item.isActive ? accent.icon : "text-slate-400 group-hover:text-slate-500"
                          }`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.trailing != null && <span className="ml-auto">{item.trailing}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* フッター：ユーザー情報と操作 */}
        <div className="shrink-0 border-t border-slate-100 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-[13px] font-semibold uppercase text-slate-600">
              {initial}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium text-slate-900">{userName}</span>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} aria-hidden="true" />
                {roleLabel}
              </span>
            </span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {actions.map(({ label, icon: ActionIcon, href, onClick }) => {
              const content = (
                <>
                  <ActionIcon className="h-[14px] w-[14px]" aria-hidden="true" />
                  {label}
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
    </>
  );
});
