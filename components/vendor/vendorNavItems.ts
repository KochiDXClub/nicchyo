// 出店者ナビの唯一の権威ある導線リスト。
// VendorNavBar（下部バーのメニューシート）と VendorSidebar（PC）の両方が
// これを参照することで、項目の食い違いを防ぐ。
//
// 来訪者向けメニューと揃えるため、絵文字ではなく線の太さを合わせたアイコンを使う
// （絵文字は端末ごとに絵柄が変わって揃わない）。

import {
  BarChart3,
  CircleHelp,
  Mail,
  Megaphone,
  Smile,
  Sparkles,
  Store,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { ShopPermission } from "@/lib/vendor/shopPermissions";

export type VendorNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  /**
   * main: お店の運営で使うページ（メニューで大きく出す）
   * support: 使い方・設定など補助的なページ（来訪者メニューの「nicchyoについて」と同じく控えめに出す）
   */
  group: "main" | "support";
  /** この導線を出すのに要る操作権限。無ければ店舗のメンバー全員に出す（代表者は常に全部出る） */
  permission?: ShopPermission;
  /** スマホの下部バーに常設している導線。下部バーと重なるので、メニューシートには出さない（PCのサイドバーには出す） */
  inBottomBar?: boolean;
};

export const VENDOR_NAV_ITEMS: VendorNavItem[] = [
  { label: "運営・市役所との連絡", href: "/vendor/inquiries", icon: Mail, description: "お知らせを見る・質問や相談を送る", group: "main", permission: "inquiries", inBottomBar: true },
  // 下部バーの「店舗情報」枠は「連絡」に差し替えたため、店舗情報への導線はここが主になる
  { label: "店舗情報を更新", href: "/vendor/store", icon: Store, description: "商品・写真・出店日をまとめて見直す", group: "main", permission: "store_edit" },
  { label: "近況を出す", href: "/vendor/posts", icon: Megaphone, description: "今日のおすすめを伝える・これまでの投稿を見返す", group: "main", permission: "post", inBottomBar: true },
  { label: "お店の分析", href: "/vendor/analytics", icon: BarChart3, description: "見られた回数とお客さんの反応", group: "main", permission: "analytics" },
  // メニューのカードは幅が狭いので短い名前にする。画面の見出しは「にちよさんが覚えちゅうこと」
  { label: "にちよさんの覚えごと", href: "/vendor/ai-knowledge", icon: Sparkles, description: "にちよさんが覚えちゅうことを見る・直す", group: "main", permission: "ai_notes" },
  // モック段階。操作権限は、近い性質の ai_notes を仮で使う（キャラ専用の権限は本実装で決める）
  { label: "お店のキャラクター", href: "/vendor/character", icon: Smile, description: "お店でAIに聞かれたとき、答えるキャラを決める", group: "main", permission: "ai_notes" },
  { label: "よくある質問", href: "/vendor/help", icon: CircleHelp, description: "困ったときに一覧から探す", group: "support" },
  { label: "アカウント設定", href: "/vendor/account", icon: UserRound, description: "メンバーの管理・招待・操作ログ", group: "support" },
];

/** 自分の権限で使える導線だけを返す（権限のない画面へ案内して、API で断られるのを避ける） */
export function visibleVendorNavItems(canShop: (permission: ShopPermission) => boolean): VendorNavItem[] {
  return VENDOR_NAV_ITEMS.filter((item) => !item.permission || canShop(item.permission));
}

/**
 * 導線（VENDOR_NAV_ITEMS）に無いが、権限が要る画面。マイ店舗の下の、店舗情報まわりの画面。
 * URL を直接開かれたときの案内（VendorAccessGate）に使う。
 */
const EXTRA_PAGE_PERMISSIONS: { prefix: string; permission: ShopPermission }[] = [
  { prefix: "/my-shop/schedule", permission: "store_edit" },
  { prefix: "/my-shop/detail", permission: "store_edit" },
  { prefix: "/my-shop/ask", permission: "store_edit" },
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** その画面を使うのに要る権限。権限が要らない画面（マイ店舗のホーム・使い方・アカウント設定など）は undefined */
export function requiredPermissionForPath(pathname: string | null): ShopPermission | undefined {
  if (!pathname) return undefined;
  const nav = VENDOR_NAV_ITEMS.find((item) => item.permission && matchesPrefix(pathname, item.href));
  if (nav) return nav.permission;
  return EXTRA_PAGE_PERMISSIONS.find((page) => matchesPrefix(pathname, page.prefix))?.permission;
}
