/**
 * ページ公開設定の判定ロジック（純粋関数）
 *
 * proxy.ts（サーバー側の遮断）と usePageVisibility（クライアント側のリンク非表示）の
 * 両方から使うため、Next.js や Supabase に依存しない。
 */

import { normalizeRole } from "@/lib/auth/permissions";
import { findRegistryEntry, type PageRegistryEntry } from "./registry";
import {
  DEFAULT_REDIRECT_TO,
  EMPTY_PAGE_VISIBILITY_SETTINGS,
  VISIBILITY_ROLES,
  VISIBILITY_STATES,
  type PageVisibilityRule,
  type PageVisibilitySettings,
  type VisibilityRole,
  type VisibilityState,
} from "./types";

export type ResolvedVisibility = {
  state: VisibilityState;
  /** state が private のときのリダイレクト先 */
  redirectTo: string;
  entry: PageRegistryEntry | null;
};

/** app_metadata.role の生文字列（未ログインなら isLoggedIn=false）を VisibilityRole に変換する */
export function toVisibilityRole(rawRole: string | null | undefined, isLoggedIn: boolean): VisibilityRole {
  if (!isLoggedIn) return "anon";
  return normalizeRole(rawRole);
}

/**
 * リダイレクト先として許可するのは「/」またはレジストリ登録済みページのパスのみ。
 * - オープンリダイレクト防止（外部URL・空白/制御文字・バックスラッシュを拒否し、URLパーサーで解決結果も検証）
 * - next.config のリダイレクトを経由したループ防止（未登録パスを許可しない）
 */
export function isSafeRedirectPath(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 200) return false;
  if (!value.startsWith("/") || /[\s\\]/.test(value)) return false;
  try {
    const url = new URL(value, "http://safe.local");
    if (url.origin !== "http://safe.local" || !url.pathname.startsWith("/")) return false;
  } catch {
    return false;
  }
  return value === DEFAULT_REDIRECT_TO || findRegistryEntry(value) !== null;
}

function isVisibilityState(value: unknown): value is VisibilityState {
  return typeof value === "string" && (VISIBILITY_STATES as readonly string[]).includes(value);
}

function isVisibilityRole(value: string): value is VisibilityRole {
  return (VISIBILITY_ROLES as readonly string[]).includes(value);
}

/**
 * jsonb から読み込んだ値を検証して PageVisibilitySettings に整形する。
 * 不正な項目・レジストリに無いパス・デフォルトと同じ値は捨てる。
 */
export function parsePageVisibilitySettings(value: unknown): PageVisibilitySettings {
  if (!value || typeof value !== "object") return EMPTY_PAGE_VISIBILITY_SETTINGS;
  const rawPages = (value as { pages?: unknown }).pages;
  if (!rawPages || typeof rawPages !== "object") return EMPTY_PAGE_VISIBILITY_SETTINGS;

  const pages: Record<string, PageVisibilityRule> = {};
  for (const [path, rawRule] of Object.entries(rawPages as Record<string, unknown>)) {
    const entry = findRegistryEntry(path);
    if (!entry || entry.path !== path) continue;
    if (!rawRule || typeof rawRule !== "object") continue;

    const rawRoles = (rawRule as { roles?: unknown }).roles;
    const roles: PageVisibilityRule["roles"] = {};
    if (rawRoles && typeof rawRoles === "object") {
      for (const [role, state] of Object.entries(rawRoles as Record<string, unknown>)) {
        if (isVisibilityRole(role) && isVisibilityState(state) && state !== "public") {
          roles[role] = state;
        }
      }
    }

    const rawRedirect = (rawRule as { redirectTo?: unknown }).redirectTo;
    const rule: PageVisibilityRule = { roles };
    if (isSafeRedirectPath(rawRedirect) && rawRedirect !== DEFAULT_REDIRECT_TO) {
      rule.redirectTo = rawRedirect;
    }

    if (Object.keys(roles).length > 0 || rule.redirectTo) {
      pages[path] = rule;
    }
  }
  return { pages };
}

/** レジストリ項目とロールから、設定で変更できない固定値があれば返す */
export function getLockedState(entry: PageRegistryEntry, role: VisibilityRole): VisibilityState | null {
  if (role === "admin") return "public";
  if (entry.codeAllowed && !entry.codeAllowed.includes(role)) return "private";
  if (entry.lockedPublic) return "public";
  return null;
}

/** pathname とロールから実効的な公開状態を返す */
export function resolvePageVisibility(
  pathname: string,
  role: VisibilityRole,
  settings: PageVisibilitySettings
): ResolvedVisibility {
  const entry = findRegistryEntry(pathname);
  if (!entry) return { state: "public", redirectTo: DEFAULT_REDIRECT_TO, entry: null };

  const rule = settings.pages[entry.path];
  const redirectTo = rule?.redirectTo ?? DEFAULT_REDIRECT_TO;

  const locked = getLockedState(entry, role);
  if (locked) return { state: locked, redirectTo, entry };

  return { state: rule?.roles[role] ?? "public", redirectTo, entry };
}

/** リンクを表示してよいか（public のときのみ true） */
export function isLinkVisible(pathname: string, role: VisibilityRole, settings: PageVisibilitySettings): boolean {
  return resolvePageVisibility(pathname, role, settings).state === "public";
}
