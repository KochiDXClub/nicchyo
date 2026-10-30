/**
 * 公開設定の対象ページ一覧（静的レジストリ）
 *
 * ファイルシステムから自動検出はせず、ここに手書きで管理する。
 * - path はパス接頭辞。`/shops` は `/shops/001` 等にもマッチする
 * - codeAllowed を持つページはコード側（proxy.ts / layout）で既にロール制限されている。
 *   設定でそれを緩めることはできず、該当ロール以外は常に private 扱いになる
 * - lockedPublic のページは全ロールで public 固定（ホーム等、リダイレクト先になり得るページ）
 * - productionDefault を持つページは、本番デプロイ（lib/pageVisibility/environment.ts）で
 *   設定が未保存のロールにその値を既定として適用する。Preview・開発では適用しない
 *
 * ログイン・サインアップ・OAuth・メンテナンス等の基盤ページは対象外。
 */

import type { VisibilityRole, VisibilityState } from "./types";

export type PageRegistryEntry = {
  path: string;
  label: string;
  group: string;
  description?: string;
  codeAllowed?: readonly VisibilityRole[];
  lockedPublic?: boolean;
  /** 本番デプロイだけで効く既定の公開状態（管理者はロールごとに上書きできる） */
  productionDefault?: Partial<Record<VisibilityRole, VisibilityState>>;
};

const MODERATOR_UP: readonly VisibilityRole[] = ["moderator", "admin"];
const ADMIN_ONLY: readonly VisibilityRole[] = ["admin"];
const VENDOR_ONLY: readonly VisibilityRole[] = ["vendor"];

/**
 * 本番マップを準備中にしている間の既定。管理者以外には店舗データを見せない
 * （管理者は常に public 固定なので、ここには書かない）。
 */
const PREPARING_IN_PRODUCTION: Partial<Record<VisibilityRole, VisibilityState>> = {
  anon: "private",
  general_user: "private",
  vendor: "private",
  moderator: "private",
};

export const PAGE_REGISTRY: readonly PageRegistryEntry[] = [
  // ── 来訪者向け ─────────────────────────────────────────────
  {
    path: "/map",
    label: "マップ（本番データ）",
    group: "来訪者向け",
    description:
      "本番の店舗データを載せた地図。本番デプロイでは管理者以外は既定で非公開（トップは「準備中」表示になる）。/api/shops・にちよさんのAPIも同じ設定で止まる",
    productionDefault: PREPARING_IN_PRODUCTION,
  },
  {
    path: "/demo/map",
    label: "マップ（デモ）",
    group: "来訪者向け",
    description: "架空の店舗データだけで動く地図。準備中のあいだ、トップのボタンからここへ案内する",
  },
  {
    path: "/facilities",
    label: "おでかけサポート",
    group: "来訪者向け",
    description: "地図上の案内機能。限定公開で入口（メニュー・起動ボタン・「ここへ案内」）を隠し、非公開で機能ごと止める",
  },
  { path: "/search", label: "店舗検索", group: "来訪者向け", productionDefault: PREPARING_IN_PRODUCTION },
  {
    path: "/shops",
    label: "店舗詳細",
    group: "来訪者向け",
    description: "/shops/001 など",
    productionDefault: PREPARING_IN_PRODUCTION,
  },
  { path: "/consult", label: "にちよさん相談", group: "来訪者向け", productionDefault: PREPARING_IN_PRODUCTION },
  {
    path: "/story",
    label: "近況",
    group: "来訪者向け",
    description: "近況（デモ）と両方公開のとき、ナビの「近況」は来訪者には近況へ直接、モデレーター以上にはどちらへ行くか選ぶメニューを出す。限定公開・非公開にすると、来訪者はデモへ行く",
  },
  {
    path: "/demo/story",
    label: "近況（デモ）",
    group: "来訪者向け",
    description: "架空の店の見本投稿と、店のAIキャラのひとことを見せるデモ。近況を公開でなくしたときは、ナビの「近況」がここへ向く",
  },
  { path: "/posts", label: "投稿一覧", group: "来訪者向け" },
  { path: "/events", label: "イベント", group: "来訪者向け" },
  { path: "/news", label: "お知らせ", group: "来訪者向け", description: "運営からのサイト内のお知らせ" },
  { path: "/calendar", label: "日曜市カレンダー", group: "来訪者向け" },
  { path: "/favorites", label: "お気に入り", group: "来訪者向け", productionDefault: PREPARING_IN_PRODUCTION },
  { path: "/activities", label: "活動記録", group: "来訪者向け" },
  { path: "/analysis", label: "来訪分析", group: "来訪者向け" },
  { path: "/about", label: "nicchyoとは", group: "来訪者向け" },
  { path: "/faq", label: "よくある質問", group: "来訪者向け" },
  { path: "/contact", label: "お問い合わせ", group: "来訪者向け" },
  { path: "/support", label: "協賛・ご支援について", group: "来訪者向け", description: "運営費と協賛のお願い" },
  { path: "/support/supporters", label: "ご支援くださった皆さま", group: "来訪者向け", description: "個人でご支援くださった方のお名前" },
  { path: "/privacy", label: "プライバシーポリシー", group: "来訪者向け" },
  { path: "/user", label: "ユーザーページ", group: "来訪者向け" },

  // ── ログインユーザー向け ─────────────────────────────────
  { path: "/my-profile", label: "マイページ", group: "ログインユーザー向け" },

  // ── 出店者向け ─────────────────────────────────────────────
  { path: "/my-shop", label: "マイショップ", group: "出店者向け", codeAllowed: VENDOR_ONLY },
  { path: "/vendor/dashboard", label: "出店者ダッシュボード", group: "出店者向け", codeAllowed: VENDOR_ONLY },
  { path: "/vendor/posts", label: "近況の投稿・履歴", group: "出店者向け", codeAllowed: VENDOR_ONLY },
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
  { path: "/admin/calendar", label: "日曜市カレンダー", group: "管理者向け", codeAllowed: ADMIN_ONLY },
  { path: "/admin/reports", label: "通報管理", group: "管理者向け", codeAllowed: ADMIN_ONLY },
  { path: "/admin/inquiries", label: "問い合わせ管理", group: "管理者向け", codeAllowed: ADMIN_ONLY },
  { path: "/admin/categories", label: "カテゴリ管理", group: "管理者向け", codeAllowed: ADMIN_ONLY },
  { path: "/admin/audit-logs", label: "監査ログ", group: "管理者向け", codeAllowed: ADMIN_ONLY },
  { path: "/admin/notifications", label: "通知", group: "管理者向け", codeAllowed: ADMIN_ONLY },
  { path: "/admin/settings", label: "設定", group: "管理者向け", codeAllowed: ADMIN_ONLY, lockedPublic: true },
  { path: "/admin/page-visibility", label: "ページ公開設定", group: "管理者向け", codeAllowed: ADMIN_ONLY, lockedPublic: true },
];

/**
 * おでかけサポートの公開設定のキー。
 *
 * おでかけサポートはページではなく地図（/map）の一部だが、機能として
 * 単独で隠したり止めたりできるようにしておく。キーには旧ページの URL を使う。
 * /facilities は地図の案内へ転送するだけの URL として残っているので、非公開にすると
 * proxy.ts がこの URL も塞ぎ、地図側（MapPageClient）も案内を開かなくなる。
 */
export const ODEKAKE_VISIBILITY_PATH = "/facilities";

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
