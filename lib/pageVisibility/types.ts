/**
 * ページ公開設定の型定義
 *
 * 管理者が各ページをロール別に「公開 / 限定公開 / 非公開」に切り替えるための設定。
 * 設定値は system_settings テーブルの key = 'page_visibility' に jsonb で保存する。
 */

import type { UserRole } from "@/lib/auth/types";

/** 公開設定の対象ロール。anon は未ログイン */
export type VisibilityRole = "anon" | UserRole;

export const VISIBILITY_ROLES: readonly VisibilityRole[] = [
  "anon",
  "general_user",
  "vendor",
  "moderator",
  "admin",
] as const;

export const VISIBILITY_ROLE_LABELS: Record<VisibilityRole, string> = {
  anon: "未ログイン",
  general_user: "一般ユーザー",
  vendor: "出店者",
  moderator: "モデレーター",
  admin: "管理者",
};

/**
 * - public:   通常公開。リンクも表示する
 * - unlisted: 限定公開。URL直打ちなら表示するがリンクは非表示
 * - private:  非公開。URL直打ちでも redirectTo へリダイレクト
 */
export type VisibilityState = "public" | "unlisted" | "private";

export const VISIBILITY_STATES: readonly VisibilityState[] = ["public", "unlisted", "private"] as const;

export const VISIBILITY_STATE_LABELS: Record<VisibilityState, string> = {
  public: "公開",
  unlisted: "限定公開",
  private: "非公開",
};

/** 1ページ分の設定。roles に無いロールは public 扱い */
export type PageVisibilityRule = {
  roles: Partial<Record<VisibilityRole, VisibilityState>>;
  /** private 時のリダイレクト先。省略時は DEFAULT_REDIRECT_TO */
  redirectTo?: string;
};

/** system_settings.page_visibility の value 全体 */
export type PageVisibilitySettings = {
  /** キーはレジストリのパス接頭辞（例: "/consult"） */
  pages: Record<string, PageVisibilityRule>;
};

export const DEFAULT_REDIRECT_TO = "/";

export const EMPTY_PAGE_VISIBILITY_SETTINGS: PageVisibilitySettings = { pages: {} };
