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
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileText,
  Gauge,
  Inbox,
  LayoutDashboard,
  Map as MapIcon,
  MessageSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  Store,
  Sun,
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
  /** 未対応件数などのバッジを出す項目か */
  badgeKey?: "notifications";
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
        label: "開催ステータス",
        href: "/admin/market-days",
        icon: Sun,
        description: "日曜市を開催するかどうかを来訪者に知らせる",
      },
      {
        label: "予定・イベント",
        href: "/admin/events",
        icon: CalendarDays,
        description: "カレンダーに出す出店予定やイベントを入稿する",
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
        description: "出店申請やことづて報告の通知を確認する",
        badgeKey: "notifications",
      },
      {
        label: "通報",
        href: "/admin/reports",
        icon: AlertTriangle,
        description: "来訪者から届いた通報を確認して対応する",
        access: "moderator",
      },
      {
        label: "問い合わせ",
        href: "/admin/inquiries",
        icon: MessageSquare,
        description: "問い合わせフォームからの相談に対応する",
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
    ],
  },
  {
    id: "system",
    label: "システム",
    access: "admin",
    items: [
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

/** 全項目をフラットに取り出す（検索や導線チェック用） */
export function getAllAdminNavItems(): AdminNavItem[] {
  return ADMIN_NAV_GROUPS.flatMap((group) => group.items);
}
