/**
 * 管理画面ナビゲーションの単一情報源
 *
 * 【設計方針】
 * - 管理画面の項目はここだけで定義する。サイドバー・ハンバーガー・ダッシュボードは
 *   すべてこの定義を読む。2箇所で手動同期していたことによる項目の抜け漏れを防ぐ。
 * - グループは「機能の種類」ではなく「運用のリズムと目的」で分ける。
 *   毎週触るものと、滅多に触らない危険な設定を同じ平面に並べないための区分け。
 * - 表示可否は項目単位ではなくグループ単位で判定する。モデレーターに歯抜けの一覧を
 *   見せず、担当範囲が画面から伝わるようにする。
 *
 * 【現時点の到達性について】
 * - `app/(public)/admin/layout.tsx` のガードは `isAdmin()` のみを通すため、
 *   現状 `/admin/*` に到達できるのは admin ロールだけ。
 * - したがって `access: "moderator" / "contentModerator"` の区分は、moderator に
 *   管理画面の一部を開放する将来の対応に備えた準備であり、今は admin 以外に
 *   このナビが表示される場面はない。開放する際は layout 側の認可を先に見直すこと。
 */

import {
  BarChart3,
  Bot,
  CalendarDays,
  ClipboardList,
  FileText,
  Frame,
  Gauge,
  Inbox,
  LayoutDashboard,
  Map as MapIcon,
  MapPin,
  MapPinned,
  Megaphone,
  QrCode,
  ScrollText,
  Settings,
  ShieldCheck,
  Stethoscope,
  Store,
  Tags,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PermissionCheck } from "@/lib/auth/types";

/** ナビ項目の表示可否を決める権限の種類 */
export type AdminNavAccess = "admin" | "moderator" | "contentModerator";

export interface AdminNavItem {
  /** 表示ラベル */
  label: string;
  /** リンク先 */
  href: string;
  /** アイコン（lucide-react。絵文字は使わない） */
  icon: LucideIcon;
  /** 一覧に添える一行説明。初見でも役割が分かるようにする */
  description: string;
  /** この項目を見られる権限。未指定はグループの権限を継承する */
  access?: AdminNavAccess;
  /** 新着の件数の赤いバッジを出す項目か（inbox=受信トレイの新着の合計） */
  badgeKey?: "inbox";
  /**
   * この項目の中の画面（タブで行き来するページ）。サイドバーでは同じ項目が選択状態になる。
   * ナビには載せず、項目の中のタブから開く（例: 受信トレイの中の通報・問い合わせ）
   */
  relatedHrefs?: string[];
}

export interface AdminNavGroup {
  /** グループID（テストやアンカーで使う） */
  id: string;
  /** グループ見出し */
  label: string;
  /** このグループを見られる権限 */
  access: AdminNavAccess;
  items: AdminNavItem[];
}

/**
 * 管理画面のナビゲーション定義
 *
 * 並び順はそのまま画面の並び順になる。新しい管理機能を追加するときは、
 * 必ずどこかのグループに入れる（入らないなら、そもそも置き場所を再検討する）。
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "home",
    label: "ホーム",
    access: "contentModerator",
    items: [
      {
        label: "ダッシュボード",
        href: "/admin/dashboard",
        icon: LayoutDashboard,
        description: "未対応の件数と今週の状況をまとめて確認する",
      },
    ],
  },
  {
    id: "weekly",
    label: "今週の運用",
    access: "admin",
    items: [
      {
        label: "日曜市カレンダー",
        href: "/admin/calendar",
        icon: CalendarDays,
        description: "開催ステータスの切替と、出店予定・イベントの入稿をまとめて行う",
      },
    ],
  },
  {
    id: "inbox",
    label: "対応する",
    access: "contentModerator",
    items: [
      {
        label: "受信トレイ",
        href: "/admin/notifications",
        icon: Inbox,
        description: "届いたもの（通知・通報・問い合わせ）をタブで切り替えて確認し、対応する",
        badgeKey: "inbox",
        relatedHrefs: ["/admin/reports", "/admin/inquiries"],
      },
      {
        label: "お知らせ",
        href: "/admin/outbox",
        icon: Megaphone,
        description: "出店者へのお知らせや、登録ユーザーへのお知らせメールを送る",
        access: "admin",
      },
      {
        label: "投稿の確認",
        href: "/admin/content",
        icon: FileText,
        description: "出店者の投稿を確認し、必要なら非公開にする",
      },
    ],
  },
  {
    id: "data",
    label: "データ管理",
    access: "admin",
    items: [
      {
        label: "店舗",
        href: "/admin/shops",
        icon: Store,
        description: "店舗情報の確認と編集を行う",
      },
      {
        label: "現場登録",
        href: "/admin/field",
        icon: MapPinned,
        description: "日曜市の現地で、店舗の情報・掲載許可・写真・位置をスマホで登録する",
      },
      {
        label: "店舗のQRコード",
        href: "/admin/shop-claims",
        icon: QrCode,
        description: "出店者に配るQRコードの発行と、アカウントとの紐づけの解除を行う",
      },
      {
        label: "ユーザー",
        href: "/admin/users",
        icon: Users,
        description: "アカウントとロールを管理する",
      },
      {
        label: "カテゴリ",
        href: "/admin/categories",
        icon: Tags,
        description: "店舗カテゴリのマスタを管理する",
      },
      {
        label: "マップ編集",
        href: "/admin/map-edit",
        icon: MapIcon,
        description: "マップ上の建物と店舗の配置を編集する",
      },
      {
        label: "マップの表示範囲",
        href: "/admin/map-view",
        icon: Frame,
        description: "マップをどこまで動かせるかを地図の上で決める",
      },
      {
        label: "スポット管理",
        href: "/admin/spots",
        icon: MapPin,
        description: "お手洗い・休けい場所・電停などのスポット情報を管理する",
      },
    ],
  },
  {
    id: "insight",
    label: "分析",
    access: "admin",
    items: [
      {
        label: "アクセス分析",
        href: "/admin/analytics",
        icon: BarChart3,
        description: "訪問者の推移や人気ページ・人気店舗を見る",
      },
      {
        label: "マップ描画の計測",
        href: "/admin/map-perf",
        icon: Gauge,
        description: "マップの描画性能を計測して比較する",
      },
      {
        label: "週次レポート",
        href: "/admin/security-reports",
        icon: ShieldCheck,
        description: "週次のセキュリティレポートを閲覧する",
      },
      {
        label: "コード健康診断",
        href: "/admin/code-health",
        icon: Stethoscope,
        description: "共通化率・コピペ率・デザインルール違反の状態を見る",
      },
    ],
  },
  {
    id: "system",
    label: "システム",
    access: "admin",
    items: [
      {
        label: "AIの設定",
        href: "/admin/ai-prompts",
        icon: Bot,
        description: "話し方と答え方、場面ごとに使うAIモデルを調整する",
      },
      {
        label: "設定",
        href: "/admin/settings",
        icon: Settings,
        description: "公開範囲・機能フラグ・通知メールをまとめて設定する",
      },
      {
        label: "監査ログ",
        href: "/admin/audit-logs",
        icon: ScrollText,
        description: "管理操作の履歴をたどる",
      },
    ],
  },
];

/** アイコンだけ使いたい箇所向け（ダッシュボードのカードなど） */
export const ADMIN_NAV_FALLBACK_ICON = ClipboardList;

/** 権限区分を PermissionCheck で解決する */
export function canAccess(access: AdminNavAccess, permissions: PermissionCheck): boolean {
  switch (access) {
    case "admin":
      return permissions.isAdmin;
    case "moderator":
      return permissions.isModerator;
    case "contentModerator":
      return permissions.isAdmin || permissions.canModerateContent;
    default:
      return false;
  }
}

/**
 * 権限に応じて表示できるグループと項目だけを返す。
 * 空になったグループは落とすので、見出しだけが残ることはない。
 */
export function getVisibleAdminNav(permissions: PermissionCheck): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS.filter((group) => canAccess(group.access, permissions))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccess(item.access ?? group.access, permissions)),
    }))
    .filter((group) => group.items.length > 0);
}

/** 現在のパスがどの項目に対応するかを判定する（サブパスも含める） */
export function isAdminNavItemActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/admin/dashboard") {
    return pathname === "/admin/dashboard" || pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** 項目の中の画面（relatedHrefs）も含めて、現在のパスがその項目かを判定する */
export function isAdminNavItemCurrent(item: AdminNavItem, pathname: string | null): boolean {
  return [item.href, ...(item.relatedHrefs ?? [])].some((href) => isAdminNavItemActive(href, pathname));
}

/** 全項目をフラットに取り出す（検索や導線チェック用） */
export function getAllAdminNavItems(): AdminNavItem[] {
  return ADMIN_NAV_GROUPS.flatMap((group) => group.items);
}

/** ナビから開ける全ページ（項目本体と、項目の中の画面）。導線チェック用 */
export function getAllAdminNavHrefs(): string[] {
  return getAllAdminNavItems().flatMap((item) => [item.href, ...(item.relatedHrefs ?? [])]);
}
