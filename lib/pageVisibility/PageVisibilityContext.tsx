"use client";

/**
 * ページ公開設定をクライアント側で参照するための Context
 *
 * - サーバー（app/layout.tsx）から読んだ設定を initial で受け取り、そのまま保持する
 * - initial が無いとき（サーバーで読めなかったとき）だけ /api/page-visibility を1回取得する
 * - usePageVisibility().isLinkVisible(path) でリンクを出すかどうかを判定する
 * - 取得前・取得失敗時は全ページ public 扱い（リンクは表示される）
 *
 * サーバー側の遮断（非公開ページへのリダイレクト）は proxy.ts が担当する。
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { EMPTY_PAGE_VISIBILITY_SETTINGS, type PageVisibilitySettings, type VisibilityRole } from "./types";
import { isLinkVisible, parsePageVisibilitySettings, resolvePageVisibility, type ResolvedVisibility } from "./resolve";

type PageVisibilityContextValue = {
  settings: PageVisibilitySettings;
  role: VisibilityRole;
  isLinkVisible: (path: string) => boolean;
  resolve: (path: string) => ResolvedVisibility;
};

const PageVisibilityContext = createContext<PageVisibilityContextValue | null>(null);

export function PageVisibilityProvider({
  children,
  initial,
}: {
  children: ReactNode;
  /** サーバーで読んだ公開設定。あればクライアントからの取得は行わない */
  initial?: PageVisibilitySettings | null;
}) {
  const { user, isLoggedIn } = useAuth();
  const [settings, setSettings] = useState<PageVisibilitySettings>(initial ?? EMPTY_PAGE_VISIBILITY_SETTINGS);

  useEffect(() => {
    if (initial) return;
    let active = true;
    void fetch("/api/page-visibility")
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (active && data) setSettings(parsePageVisibilitySettings(data));
      })
      .catch(() => {
        /* 取得失敗時は全ページ public 扱い */
      });
    return () => {
      active = false;
    };
  }, [initial]);

  const role: VisibilityRole = isLoggedIn && user ? user.role : "anon";

  const value = useMemo<PageVisibilityContextValue>(
    () => ({
      settings,
      role,
      isLinkVisible: (path) => isLinkVisible(path, role, settings),
      resolve: (path) => resolvePageVisibility(path, role, settings),
    }),
    [role, settings]
  );

  return <PageVisibilityContext.Provider value={value}>{children}</PageVisibilityContext.Provider>;
}

const FALLBACK: PageVisibilityContextValue = {
  settings: EMPTY_PAGE_VISIBILITY_SETTINGS,
  role: "anon",
  isLinkVisible: () => true,
  resolve: (path) => resolvePageVisibility(path, "anon", EMPTY_PAGE_VISIBILITY_SETTINGS),
};

/** Provider 外で呼ばれた場合は全ページ public 扱いで動く */
export function usePageVisibility(): PageVisibilityContextValue {
  return useContext(PageVisibilityContext) ?? FALLBACK;
}
