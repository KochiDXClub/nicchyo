/**
 * ハンバーガーメニュー
 *
 * - ロール別のリンクを出し分け
 * - デモ用に AuthContext の login を呼び出す簡易ログインボタンを用意
 * - MenuContext と連動してヘッダーの表示を制御
 */

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { useMenu } from '@/lib/ui/MenuContext';
import { getRoleTheme } from '@/lib/theme/roleTheme';
import { usePageVisibility } from '@/lib/pageVisibility/PageVisibilityContext';

export default function HamburgerMenu() {
  const { isMenuOpen, toggleMenu, closeMenu } = useMenu();
  const { isLoggedIn, user, logout, permissions } = useAuth();
  const pathname = usePathname();
  const theme = getRoleTheme(user?.role);

  useEffect(() => {
    const root = document.documentElement;
    const desktopMenuWidth = '20rem';
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;

    root.style.setProperty(
      '--desktop-menu-offset',
      isMenuOpen && isDesktop ? desktopMenuWidth : '0px'
    );

    return () => {
      root.style.setProperty('--desktop-menu-offset', '0px');
    };
  }, [isMenuOpen]);

  const handleLogout = () => {
    logout();
    closeMenu();
  };

  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);
  const menuItemClass = (href: string, hoverClass = 'hover:bg-gray-50') =>
    `flex items-center gap-3 rounded-lg px-4 py-3 transition ${
      isActive(href)
        ? `${theme.accent.bg} ${theme.accent.text} shadow-sm`
        : `text-gray-700 ${hoverClass}`
    }`;

  return (
    <>
      {/* ハンバーガーボタン（固定位置・オーバーレイ） */}
      <button
        type="button"
        onClick={toggleMenu}
        className={`hamburger-button fixed top-4 right-4 z-[10002] flex h-12 w-12 items-center justify-center rounded-lg bg-white/90 text-gray-700 shadow-md transition hover:bg-white hover:shadow-lg ${
          isMenuOpen ? "is-open" : "is-closed"
        }`}
        aria-label="メニュー"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={isMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
          />
        </svg>
      </button>

      {/* 背景オーバーレイ */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[9998] bg-black/30 backdrop-blur-sm lg:hidden" onClick={closeMenu} />
      )}

      {/* スライドメニュー */}
      <div
        className={`fixed right-0 top-0 z-[9999] h-[100dvh] h-[calc(var(--vh,1vh)*100)] w-80 max-w-[90vw] transform bg-white shadow-2xl transition-transform duration-300 lg:border-l lg:border-gray-200 ${
          isMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          paddingTop: 'var(--safe-top, 0px)',
          paddingBottom: 'var(--safe-bottom, 0px)',
        }}
      >
        <div className="flex h-full flex-col">
          {/* ヘッダー */}
          <div className={`${theme.headerBg} ${theme.headerText} border-b border-white/10 px-4 py-4`}>
            <div className="flex min-h-[56px] items-center gap-3">
              <span className="text-2xl" aria-hidden="true">🗺️</span>
              <div>
                <h2 className="text-lg font-semibold">nicchyoメニュー</h2>
              </div>
            </div>
          </div>

          {/* プロフィール表示 */}
          <div className="border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4">
            {isLoggedIn && user ? (
              <Link href={permissions.isVendor ? "/vendor/account" : "/my-profile"} onClick={closeMenu} className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-amber-500 text-white text-xl font-bold">
                  {user.avatarUrl ? (
                    <Image src={user.avatarUrl} alt={user.name} width={48} height={48} className="h-full w-full object-cover" />
                  ) : (
                    user.name.charAt(0)
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 border border-amber-100">
                      <MenuIcon name="user" className="h-3.5 w-3.5 text-amber-700" />
                      一般ユーザー
                    </span>
                    {permissions.isAdmin && (
                      <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                        管理者
                      </span>
                    )}
                    {permissions.isModerator && (
                      <span className="rounded-full bg-purple-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                        モデレーター
                      </span>
                    )}
                    {permissions.isVendor && (
                      <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                        出店者
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ) : (
              <div className="text-sm text-gray-700">
                ログインすると保存やお買い物リストが利用できます。
              </div>
            )}
          </div>

          {/* メニュー本体 */}
          <nav className="flex-1 overflow-y-auto px-4 py-4">
            <ul className="space-y-2">
              {isLoggedIn ? (
                <>
                  {permissions.isAdmin && (
                    <>
                      <li>
                        <div className="rounded-lg bg-red-50 px-3 py-2 mb-2">
                          <p className="text-xs font-semibold text-red-700 flex items-center gap-1">
                            <MenuIcon name="settings" className="h-4 w-4 text-red-700" />
                            管理メニュー
                          </p>
                        </div>
                      </li>
                      <MenuLi href="/admin/dashboard">
                        <Link
                          href="/admin/dashboard"
                          onClick={closeMenu}
                          className={menuItemClass('/admin/dashboard', 'hover:bg-red-50')}
                        >
                          <MenuIcon name="chart" className={`h-5 w-5 ${isActive('/admin/dashboard') ? 'text-white' : 'text-red-600'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">ダッシュボード</p>
                            <p className={`text-xs ${isActive('/admin/dashboard') ? 'text-white/80' : 'text-gray-500'}`}>アクセスと運用状況を確認</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive('/admin/dashboard') ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>
                            管理
                          </span>
                        </Link>
                      </MenuLi>
                      <MenuLi href="/admin/analytics">
                        <Link
                          href="/admin/analytics"
                          onClick={closeMenu}
                          className={menuItemClass('/admin/analytics', 'hover:bg-red-50')}
                        >
                          <MenuIcon name="chart" className={`h-5 w-5 ${isActive('/admin/analytics') ? 'text-white' : 'text-red-600'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">アナリティクス</p>
                            <p className={`text-xs ${isActive('/admin/analytics') ? 'text-white/80' : 'text-gray-500'}`}>訪問者・検索・AI分析</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive('/admin/analytics') ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>
                            管理
                          </span>
                        </Link>
                      </MenuLi>
                      <MenuLi href="/admin/map-edit">
                        <Link
                          href="/admin/map-edit"
                          onClick={closeMenu}
                          className={menuItemClass('/admin/map-edit', 'hover:bg-red-50')}
                        >
                          <MenuIcon name="shop" className={`h-5 w-5 ${isActive('/admin/map-edit') ? 'text-white' : 'text-red-600'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">マップ編集</p>
                            <p className={`text-xs ${isActive('/admin/map-edit') ? 'text-white/80' : 'text-gray-500'}`}>店舗マーカと建物を編集</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive('/admin/map-edit') ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>
                            管理
                          </span>
                        </Link>
                      </MenuLi>
                      <MenuLi href="/admin/users">
                        <Link
                          href="/admin/users"
                          onClick={closeMenu}
                          className={menuItemClass('/admin/users', 'hover:bg-red-50')}
                        >
                          <MenuIcon name="users" className={`h-5 w-5 ${isActive('/admin/users') ? 'text-white' : 'text-red-600'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">ユーザー管理</p>
                            <p className={`text-xs ${isActive('/admin/users') ? 'text-white/80' : 'text-gray-500'}`}>アカウントと権限を確認</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive('/admin/users') ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>
                            管理
                          </span>
                        </Link>
                      </MenuLi>
                      <MenuLi href="/admin/content">
                        <Link
                          href="/admin/content"
                          onClick={closeMenu}
                          className={menuItemClass('/admin/content', 'hover:bg-red-50')}
                        >
                          <MenuIcon name="pencil" className={`h-5 w-5 ${isActive('/admin/content') ? 'text-white' : 'text-red-600'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">コンテンツ管理</p>
                            <p className={`text-xs ${isActive('/admin/content') ? 'text-white/80' : 'text-gray-500'}`}>出店者の投稿を管理</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive('/admin/content') ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>
                            管理
                          </span>
                        </Link>
                      </MenuLi>
                      <MenuLi href="/admin/audit-logs">
                        <Link
                          href="/admin/audit-logs"
                          onClick={closeMenu}
                          className={menuItemClass('/admin/audit-logs', 'hover:bg-red-50')}
                        >
                          <MenuIcon name="list" className={`h-5 w-5 ${isActive('/admin/audit-logs') ? 'text-white' : 'text-red-600'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">監査ログ</p>
                            <p className={`text-xs ${isActive('/admin/audit-logs') ? 'text-white/80' : 'text-gray-500'}`}>管理者の操作履歴</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive('/admin/audit-logs') ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>
                            管理
                          </span>
                        </Link>
                      </MenuLi>
                      <MenuLi href="/admin/notifications">
                        <Link
                          href="/admin/notifications"
                          onClick={closeMenu}
                          className={menuItemClass('/admin/notifications', 'hover:bg-red-50')}
                        >
                          <MenuIcon name="bell" className={`h-5 w-5 ${isActive('/admin/notifications') ? 'text-white' : 'text-red-600'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">通知</p>
                            <p className={`text-xs ${isActive('/admin/notifications') ? 'text-white/80' : 'text-gray-500'}`}>申請・報告のお知らせ</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive('/admin/notifications') ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>
                            管理
                          </span>
                        </Link>
                      </MenuLi>
                      <MenuLi href="/admin/settings">
                        <Link
                          href="/admin/settings"
                          onClick={closeMenu}
                          className={menuItemClass('/admin/settings', 'hover:bg-red-50')}
                        >
                          <MenuIcon name="settings" className={`h-5 w-5 ${isActive('/admin/settings') ? 'text-white' : 'text-red-600'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">設定</p>
                            <p className={`text-xs ${isActive('/admin/settings') ? 'text-white/80' : 'text-gray-500'}`}>公開設定と運用上限</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive('/admin/settings') ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>
                            管理
                          </span>
                        </Link>
                      </MenuLi>
                      <MenuLi href="/admin/page-visibility">
                        <Link
                          href="/admin/page-visibility"
                          onClick={closeMenu}
                          className={menuItemClass('/admin/page-visibility', 'hover:bg-red-50')}
                        >
                          <MenuIcon name="list" className={`h-5 w-5 ${isActive('/admin/page-visibility') ? 'text-white' : 'text-red-600'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">ページ公開設定</p>
                            <p className={`text-xs ${isActive('/admin/page-visibility') ? 'text-white/80' : 'text-gray-500'}`}>ロール別に公開・非公開を切替</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive('/admin/page-visibility') ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>
                            管理
                          </span>
                        </Link>
                      </MenuLi>
                      <li>
                        <div className="my-3 border-t border-gray-200" />
                      </li>
                    </>
                  )}

                  {permissions.isModerator && !permissions.isAdmin && (
                    <>
                      <li>
                        <div className="rounded-lg bg-purple-50 px-3 py-2 mb-2">
                          <p className="text-xs font-semibold text-purple-700 flex items-center gap-1">
                            <MenuIcon name="shield" className="h-4 w-4 text-purple-700" />
                            モデレーターメニュー
                          </p>
                        </div>
                      </li>
                      <MenuLi href="/moderator">
                        <Link
                          href="/moderator"
                          onClick={closeMenu}
                          className={menuItemClass('/moderator', 'hover:bg-purple-50')}
                        >
                          <MenuIcon name="shield" className={`h-5 w-5 ${isActive('/moderator') ? 'text-white' : 'text-purple-600'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">モデレーションダッシュボード</p>
                            <p className={`text-xs ${isActive('/moderator') ? 'text-white/80' : 'text-gray-500'}`}>投稿管理</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive('/moderator') ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'}`}>
                            モデレーター
                          </span>
                        </Link>
                      </MenuLi>
                      <li>
                        <div className="my-3 border-t border-gray-200" />
                      </li>
                    </>
                  )}

                  {permissions.isVendor && (
                    <>
                      <li>
                        <div className="rounded-lg bg-amber-50 px-3 py-2 mb-2">
                          <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                            <MenuIcon name="shop" className="h-4 w-4 text-amber-700" />
                            出店者メニュー
                          </p>
                        </div>
                      </li>
                      <MenuLi href="/my-shop">
                        <Link
                          href="/my-shop"
                          onClick={closeMenu}
                          className={menuItemClass('/my-shop', 'hover:bg-amber-50')}
                        >
                          <MenuIcon name="shop" className={`h-5 w-5 ${isActive('/my-shop') ? 'text-white' : 'text-amber-600'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">マイ店舗</p>
                            <p className={`text-xs ${isActive('/my-shop') ? 'text-white/80' : 'text-gray-500'}`}>店舗ページを見る</p>
                          </div>
                        </Link>
                      </MenuLi>
                      <MenuLi href="/vendor/post/new">
                        <Link
                          href="/vendor/post/new"
                          onClick={closeMenu}
                          className={menuItemClass('/vendor/post/new', 'hover:bg-amber-50')}
                        >
                          <MenuIcon name="pencil" className={`h-5 w-5 ${isActive('/vendor/post/new') ? 'text-white' : 'text-amber-600'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">最新情報の投稿</p>
                            <p className={`text-xs ${isActive('/vendor/post/new') ? 'text-white/80' : 'text-gray-500'}`}>お知らせや出店情報を発信</p>
                          </div>
                        </Link>
                      </MenuLi>
                      <MenuLi href="/vendor/store">
                        <Link
                          href="/vendor/store"
                          onClick={closeMenu}
                          className={menuItemClass('/vendor/store', 'hover:bg-amber-50')}
                        >
                          <MenuIcon name="store-edit" className={`h-5 w-5 ${isActive('/vendor/store') ? 'text-white' : 'text-amber-600'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">出店情報の更新</p>
                            <p className={`text-xs ${isActive('/vendor/store') ? 'text-white/80' : 'text-gray-500'}`}>営業時間・商品・SNSなど</p>
                          </div>
                        </Link>
                      </MenuLi>
                      <MenuLi href="/vendor/analytics">
                        <Link
                          href="/vendor/analytics"
                          onClick={closeMenu}
                          className={menuItemClass('/vendor/analytics', 'hover:bg-amber-50')}
                        >
                          <MenuIcon name="chart" className={`h-5 w-5 ${isActive('/vendor/analytics') ? 'text-white' : 'text-amber-600'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">お店の分析</p>
                            <p className={`text-xs ${isActive('/vendor/analytics') ? 'text-white/80' : 'text-gray-500'}`}>閲覧数・商品・AI分析</p>
                          </div>
                        </Link>
                      </MenuLi>
                      <MenuLi href="/vendor/ai-knowledge">
                        <Link
                          href="/vendor/ai-knowledge"
                          onClick={closeMenu}
                          className={menuItemClass('/vendor/ai-knowledge', 'hover:bg-amber-50')}
                        >
                          <MenuIcon name="sparkles" className={`h-5 w-5 ${isActive('/vendor/ai-knowledge') ? 'text-white' : 'text-amber-600'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">AIばあちゃんに教える</p>
                            <p className={`text-xs ${isActive('/vendor/ai-knowledge') ? 'text-white/80' : 'text-gray-500'}`}>お店の情報を学習させる</p>
                          </div>
                        </Link>
                      </MenuLi>
                      <MenuLi href="/vendor/account">
                        <Link
                          href="/vendor/account"
                          onClick={closeMenu}
                          className={menuItemClass('/vendor/account', 'hover:bg-amber-50')}
                        >
                          <MenuIcon name="user" className={`h-5 w-5 ${isActive('/vendor/account') ? 'text-white' : 'text-amber-600'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">アカウント設定</p>
                            <p className={`text-xs ${isActive('/vendor/account') ? 'text-white/80' : 'text-gray-500'}`}>名前・メール・パスワード変更</p>
                          </div>
                        </Link>
                      </MenuLi>
                      <MenuLi href="/vendor/help">
                        <Link
                          href="/vendor/help"
                          onClick={closeMenu}
                          className={menuItemClass('/vendor/help', 'hover:bg-amber-50')}
                        >
                          <MenuIcon name="help" className={`h-5 w-5 ${isActive('/vendor/help') ? 'text-white' : 'text-amber-600'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">使い方ガイド</p>
                            <p className={`text-xs ${isActive('/vendor/help') ? 'text-white/80' : 'text-gray-500'}`}>各機能の説明</p>
                          </div>
                        </Link>
                      </MenuLi>
                      <li>
                        <div className="my-3 border-t border-gray-200" />
                      </li>
                    </>
                  )}

                  {permissions.isGeneralUser && (
                    <>
                      <MenuLi href="/bag">
                        <Link
                          href="/bag"
                          onClick={closeMenu}
                          className={menuItemClass('/bag', 'hover:bg-amber-50')}
                        >
                          <MenuIcon name="bag" className={`h-5 w-5 ${isActive('/bag') ? 'text-white' : 'text-gray-600'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">お買い物リスト</p>
                            <p className={`text-xs ${isActive('/bag') ? 'text-white/80' : 'text-gray-500'}`}>買うものをメモ</p>
                          </div>
                        </Link>
                      </MenuLi>
                    </>
                  )}

                  <li>
                    <div className="my-3 border-t border-gray-200" />
                  </li>

                  <li>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-gray-700 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <MenuIcon name="logout" className="h-5 w-5 text-red-600" />
                      <p className="text-sm font-medium">ログアウト</p>
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <MenuLi href="/bag">
                    <Link
                      href="/bag"
                      onClick={closeMenu}
                      className="flex items-center gap-3 rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-100 hover:shadow-md"
                    >
                      <MenuIcon name="bag" className="h-5 w-5 text-amber-700" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">お買い物リスト</p>
                        <p className="text-xs text-amber-700/80">買うものをメモ</p>
                      </div>
                    </Link>
                  </MenuLi>
                </>
              )}

              <li>
                <div className="my-3 border-t border-gray-200" />
              </li>

              <MenuLi href="/about">
                <Link
                  href="/about"
                  onClick={closeMenu}
                  className={menuItemClass('/about')}
                >
                  <MenuIcon name="info" className={`h-5 w-5 ${isActive('/about') ? 'text-white' : 'text-gray-600'}`} />
                  <p className="text-sm font-medium">このサービスについて</p>
                </Link>
              </MenuLi>
              <MenuLi href="/analysis">
                <Link
                  href="/analysis"
                  onClick={closeMenu}
                  className={menuItemClass('/analysis')}
                >
                  <MenuIcon name="chart" className={`h-5 w-5 ${isActive('/analysis') ? 'text-white' : 'text-gray-600'}`} />
                  <p className="text-sm font-medium">日曜市をデータで見る</p>
                </Link>
              </MenuLi>
              {!isLoggedIn && (
                <>
                  <MenuLi href="/login">
                    <Link
                      href="/login"
                      onClick={closeMenu}
                      className={menuItemClass('/login')}
                    >
                      <MenuIcon name="user" className={`h-5 w-5 ${isActive('/login') ? 'text-white' : 'text-gray-600'}`} />
                      <p className="text-sm font-medium">ログイン</p>
                    </Link>
                  </MenuLi>
                  <MenuLi href="/signup">
                    <Link
                      href="/signup"
                      onClick={closeMenu}
                      className={menuItemClass('/signup')}
                    >
                      <MenuIcon name="user" className={`h-5 w-5 ${isActive('/signup') ? 'text-white' : 'text-gray-600'}`} />
                      <p className="text-sm font-medium">アカウントを作成</p>
                    </Link>
                  </MenuLi>
                </>
              )}
              <MenuLi href="/faq">
                <Link
                  href="/faq"
                  onClick={closeMenu}
                  className={menuItemClass('/faq')}
                >
                  <MenuIcon name="help" className={`h-5 w-5 ${isActive('/faq') ? 'text-white' : 'text-gray-600'}`} />
                  <p className="text-sm font-medium">よくある質問</p>
                </Link>
              </MenuLi>
              <MenuLi href="/contact">
                <Link
                  href="/contact"
                  onClick={closeMenu}
                  className={menuItemClass('/contact')}
                >
                  <MenuIcon name="mail" className={`h-5 w-5 ${isActive('/contact') ? 'text-white' : 'text-gray-600'}`} />
                  <p className="text-sm font-medium">お問い合わせ</p>
                </Link>
              </MenuLi>
            </ul>
          </nav>

          {/* フッター */}
          <div className="border-t border-gray-200 px-6 py-4">
            <p className="text-xs text-gray-500 text-center">&copy; 2026 nicchyo</p>
          </div>
        </div>
      </div>
    </>
  );
}

type MenuIconName =
  | 'user'
  | 'settings'
  | 'shop'
  | 'store-edit'
  | 'pencil'
  | 'list'
  | 'sparkles'
  | 'users'
  | 'shield'
  | 'bag'
  | 'logout'
  | 'info'
  | 'help'
  | 'mail'
  | 'chat'
  | 'chart'
  | 'bell';

type MenuIconProps = {
  name: MenuIconName;
  className?: string;
};

/** ページ公開設定で public でないリンクはメニューに出さない */
function MenuLi({ href, children }: { href: string; children: ReactNode }) {
  const { isLinkVisible } = usePageVisibility();
  if (!isLinkVisible(href)) return null;
  return <li>{children}</li>;
}

function MenuIcon({ name, className }: MenuIconProps) {
  const props = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
  } as const;

  switch (name) {
    case 'user':
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 20.118a7.5 7.5 0 0 1 15 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.5-1.632Z"
          />
        </svg>
      );
    case 'settings':
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.094c.55 0 1.02.398 1.11.94l.149.9c.07.424.37.77.78.93l.845.34c.5.2 1.07.04 1.41-.3l.672-.672c.39-.39 1.04-.39 1.43 0l.774.774c.39.39.39 1.02 0 1.41l-.672.672c-.34.34-.5.91-.3 1.41l.34.845c.16.41.51.71.93.78l.9.149c.54.09.94.56.94 1.11v1.094c0 .55-.4 1.02-.94 1.11l-.9.149c-.42.07-.77.37-.93.78l-.34.845c-.2.5-.04 1.07.3 1.41l.672.672c.39.39.39 1.04 0 1.43l-.774.774c-.39.39-1.04.39-1.43 0l-.672-.672c-.34-.34-.91-.5-1.41-.3l-.845.34c-.41.16-.71.51-.78.93l-.149.9c-.09.54-.56.94-1.11.94h-1.094c-.55 0-1.02-.4-1.11-.94l-.149-.9c-.07-.42-.37-.77-.78-.93l-.845-.34c-.5-.2-1.07-.04-1.41.3l-.672.672c-.39.39-1.04.39-1.43 0l-.774-.774c-.39-.39-.39-1.04 0-1.43l.672-.672c.34-.34.5-.91.3-1.41l-.34-.845c-.16-.41-.51-.71-.93-.78l-.9-.149c-.54-.09-.94-.56-.94-1.11v-1.094c0-.55.4-1.02.94-1.11l.9-.149c.42-.07.77-.37.93-.78l.34-.845c.2-.5.04-1.07-.3-1.41l-.672-.672c-.39-.39-.39-1.02 0-1.41l.774-.774c.39-.39 1.04-.39 1.43 0l.672.672c.34.34.91.5 1.41.3l.845-.34c.41-.16.71-.51.78-.93l.149-.9Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      );
    case 'shop':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75 12 4.5l9 5.25" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 10.5V20.25A1.5 1.5 0 0 0 6 21.75h12a1.5 1.5 0 0 0 1.5-1.5V10.5"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 21.75V15a.75.75 0 0 1 .75-.75h4.5A.75.75 0 0 1 15 15v6.75"
          />
        </svg>
      );
    case 'users':
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 18.72a9.09 9.09 0 0 0 3.74 1.98 9.06 9.06 0 0 1-3.74.8c-2.93 0-5.62-.7-7.88-1.9"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 8.25a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 19.5a7.5 7.5 0 0 1 15 0"
          />
        </svg>
      );
    case 'shield':
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3.75 5.25 6.75v6a6.75 6.75 0 0 0 13.5 0v-6L12 3.75Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 10.5" />
        </svg>
      );
    case 'bag':
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 7.5V6a6 6 0 1 1 12 0v1.5"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 7.5h15l-1.2 12.6a2.25 2.25 0 0 1-2.24 2.05H7.94a2.25 2.25 0 0 1-2.24-2.05L4.5 7.5Z"
          />
        </svg>
      );
    case 'logout':
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6A2.25 2.25 0 0 0 5.25 5.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l3 3-3 3" />
        </svg>
      );
    case 'info':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9h.01M11.25 12h1.5v4.5h-1.5z" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      );
    case 'help':
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.75 9a2.25 2.25 0 1 1 3.99 1.5c-.67.67-1.49 1.12-1.49 2.25v.25"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 17.25h.01" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      );
    case 'mail':
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 6.75h18v10.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.25V6.75Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="m3 6.75 9 6 9-6" />
        </svg>
      );
    case 'chat':
      return (
        <svg {...props}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
          />
        </svg>
      );
    case 'chart':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 19.5h16.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 16.5V10.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V7.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 16.5V12" />
        </svg>
      );
    case 'store-edit':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75 12 4.5l9 5.25" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5V18.75A1.5 1.5 0 0 0 6 20.25h4.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5v3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m14.25 17.25 1.5-1.5 3 3-1.5 1.5-3-3Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m17.25 15.75 1.5-1.5" />
        </svg>
      );
    case 'pencil':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
        </svg>
      );
    case 'list':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
      );
    default:
      return null;
  }
}

