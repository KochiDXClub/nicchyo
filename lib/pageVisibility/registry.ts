/**
 * 公開設定の対象ページ一覧（静的レジストリ）
 *
 * ファイルシステムから自動検出はせず、ここに手書きで管理する。
 * - path はパス接頭辞。`/shops` は `/shops/001` 等にもマッチする
 * - codeAllowed を持つページはコード側（proxy.ts / layout）で既にロール制限されている。
 *   設定でそれを緩めることはできず、該当ロール以外は常に private 扱いになる
 * - lockedPublic のページは全ロールで public 固定（ホーム等、リダイレクト先になり得るページ）
 *
 * ログイン・サインアップ・OAuth・メンテナンス等の基盤ページは対象外。
 */

import type { VisibilityRole } from "./types";

export type PageRegistryEntry = {
  path: string;
  label: string;
  group: string;
  description?: string;
  codeAllowed?: readonly VisibilityRole[];
  lockedPublic?: boolean;
};

const MODERATOR_UP: readonly VisibilityRole[] = ["moderator", "admin"];
const ADMIN_ONLY: readonly VisibilityRole[] = ["admin"];
const VENDOR_ONLY: readonly VisibilityRole[] = ["vendor"];

export const PAGE_REGISTRY: readonly PageRegistryEntry[] = [
  // ── 来訪者向け ─────────────────────────────────────────────
  { path: "/map", label: "マップ", group: "来訪者向け", description: "ホーム。常に公開", lockedPublic: true },
  { path: "/search", label: "店舗検索", group: "来訪者向け" },
  { path: "/shops", label: "店舗詳細", group: "来訪者向け", description: "/shops/001 など" },
  { path: "/consult", label: "にちよさん相談", group: "来訪者向け" },
  { path: "/story", label: "近況", group: "来訪者向け" },
  { path: "/posts", label: "投稿一覧", group: "来訪者向け" },
  { path: "/events", label: "イベント", group: "来訪者向け" },
  { path: "/calendar", label: "日曜市カレンダー", group: "来訪者向け" },
  { path: "/facilities", label: "おでかけサポート", group: "来訪者向け" },
  { path: "/bag", label: "買い物リスト", group: "来訪者向け" },
  { path: "/activities", label: "活動記録", group: "来訪者向け" },
  { path: "/reports", label: "開催レポート", group: "来訪者向け" },
  { path: "/analysis", label: "来訪分析", group: "来訪者向け" },
  { path: "/about", label: "nicchyoとは", group: "来訪者向け" },
  { path: "/faq", label: "よくある質問", group: "来訪者向け" },
  { path: "/contact", label: "お問い合わせ", group: "来訪者向け" },
  { path: "/privacy", label: "プライバシーポリシー", group: "来訪者向け" },
  { path: "/user", label: "ユーザーページ", group: "来訪者向け" },

  // ── ログインユーザー向け ─────────────────────────────────
  { path: "/my-profile", label: "マイページ", group: "ログインユーザー向け" },

  // ── 出店者向け ─────────────────────────────────────────────
  { path: "/my-shop", label: "マイショップ", group: "出店者向け", codeAllowed: VENDOR_ONLY },
  { path: "/vendor/dashboard", label: "出店者ダッシュボード", group: "出店者向け", codeAllowed: VENDOR_ONLY },
  { path: "/vendor/post", label: "投稿作成", group: "出店者向け", codeAllowed: VENDOR_ONLY },
  { path: "/vendor/posts", label: "投稿管理", group: "出店者向け", codeAllowed: VENDOR_ONLY },
  { path: "/vendor/store", label: "店舗情報編集", group: "出店者向け", codeAllowed: VENDOR_ONLY },
  { path: "/vendor/analytics", label: "出店者アナリティクス", group: "出店者向け", codeAllowed: VENDOR_ONLY },
  { path: "/vendor/ai-knowledge", label: "AIナレッジ", group: "出店者向け", codeAllowed: VENDOR_ONLY },
  { path: "/vendor/account", label: "出店者アカウント", group: "出店者向け", codeAllowed: VENDOR_ONLY },
  { path: "/vendor/help", label: "出店者ヘルプ", group: "出店者向け", codeAllowed: VENDOR_ONLY },

  // ── モデレーター向け ───────────────────────────────────────
  { path: "/moderator", label: "モデレーター", group: "モデレーター向け", codeAllowed: MODERATOR_UP },

  // ── 管理者向け ─────────────────────────────────────────────
  { path: "/admin/dashboard", label: "管理ダッシュボード", group: "管理者向け", codeAllowed: ADMIN_ONLY },
  { path: "/admin/analytics", label: "アナリティクス", group: "管理者向け", codeAllowed: ADMIN_ONLY },
  { path: "/admin/map-edit", label: "マップ編集", group: "管理者向け", codeAllowed: ADMIN_ONLY },
  { path: "/admin/users", label: "ユーザー管理", group: "管理者向け", codeAllowed: ADMIN_ONLY },
  { path: "/admin/content", label: "コンテンツ管理", group: "管理者向け", codeAllowed: ADMIN_ONLY },
  { path: "/admin/market-days", label: "開催ステータス", group: "管理者向け", codeAllowed: ADMIN_ONLY },
  { path: "/admin/events", label: "イベント管理", group: "管理者向け", codeAllowed: ADMIN_ONLY },
  { path: "/admin/reports", label: "通報管理", group: "管理者向け", codeAllowed: ADMIN_ONLY },
  { path: "/admin/inquiries", label: "問い合わせ管理", group: "管理者向け", codeAllowed: ADMIN_ONLY },
  { path: "/admin/categories", label: "カテゴリ管理", group: "管理者向け", codeAllowed: ADMIN_ONLY },
  { path: "/admin/audit-logs", label: "監査ログ", group: "管理者向け", codeAllowed: ADMIN_ONLY },
  { path: "/admin/notifications", label: "通知", group: "管理者向け", codeAllowed: ADMIN_ONLY },
  { path: "/admin/settings", label: "設定", group: "管理者向け", codeAllowed: ADMIN_ONLY, lockedPublic: true },
  { path: "/admin/page-visibility", label: "ページ公開設定", group: "管理者向け", codeAllowed: ADMIN_ONLY, lockedPublic: true },
];

/** pathname に最も長く前方一致するレジストリ項目を返す。無ければ null */
export function findRegistryEntry(pathname: string): PageRegistryEntry | null {
  let best: PageRegistryEntry | null = null;
  for (const entry of PAGE_REGISTRY) {
    if (pathname === entry.path || pathname.startsWith(`${entry.path}/`)) {
      if (!best || entry.path.length > best.path.length) best = entry;
    }
  }
  return best;
}
