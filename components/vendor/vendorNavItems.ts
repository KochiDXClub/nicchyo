// 出店者ナビの唯一の権威ある導線リスト。
// VendorNavBar（下部バーのメニューシート）と VendorSidebar（PC）の両方が
// これを参照することで、項目の食い違いを防ぐ。
//
// 来訪者向けメニューと揃えるため、絵文字ではなく線の太さを合わせたアイコンを使う
// （絵文字は端末ごとに絵柄が変わって揃わない）。

import {
  BarChart3,
  CircleHelp,
  History,
  Mail,
  Megaphone,
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
};

export const VENDOR_NAV_ITEMS: VendorNavItem[] = [
  { label: "運営・市役所との連絡", href: "/vendor/inquiries", icon: Mail, description: "お知らせを見る・質問や相談を送る", group: "main", permission: "inquiries" },
  // 下部バーの「店舗情報」枠は「連絡」に差し替えたため、店舗情報への導線はここが主になる
  { label: "店舗情報を更新", href: "/vendor/store", icon: Store, description: "商品・写真・出店日をまとめて見直す", group: "main", permission: "store_edit" },
  { label: "近況を出す", href: "/vendor/post/new", icon: Megaphone, description: "今日のおすすめや売り切れを伝える", group: "main", permission: "post" },
  { label: "投稿履歴", href: "/vendor/posts", icon: History, description: "これまでの投稿を見返す", group: "main", permission: "post" },
  { label: "お店の分析", href: "/vendor/analytics", icon: BarChart3, description: "見られた回数とお客さんの反応", group: "main", permission: "analytics" },
  // メニューのカードは幅が狭いので短い名前にする。画面の見出しは「にちよさんが覚えちゅうこと」
  { label: "にちよさんの覚えごと", href: "/vendor/ai-knowledge", icon: Sparkles, description: "にちよさんが覚えちゅうことを見る・直す", group: "main", permission: "ai_notes" },
  { label: "よくある質問", href: "/vendor/help", icon: CircleHelp, description: "困ったときに一覧から探す", group: "support" },
  { label: "アカウント設定", href: "/vendor/account", icon: UserRound, description: "名前やメール、パスワードの確認", group: "support" },
];

/** 自分の権限で使える導線だけを返す（権限のない画面へ案内して、API で断られるのを避ける） */
export function visibleVendorNavItems(canShop: (permission: ShopPermission) => boolean): VendorNavItem[] {
  return VENDOR_NAV_ITEMS.filter((item) => !item.permission || canShop(item.permission));
}
