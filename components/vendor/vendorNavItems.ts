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
};

export const VENDOR_NAV_ITEMS: VendorNavItem[] = [
  { label: "運営・市役所に連絡", href: "/vendor/inquiries", icon: Mail, description: "質問・報告・相談を送る", group: "main" },
  // 下部バーの「店舗情報」枠は「連絡」に差し替えたため、店舗情報への導線はここが主になる
  { label: "店舗情報を更新", href: "/vendor/store", icon: Store, description: "商品・写真・出店日をまとめて見直す", group: "main" },
  { label: "最新情報を発信", href: "/vendor/post/new", icon: Megaphone, description: "今日のおすすめや売り切れを伝える", group: "main" },
  { label: "投稿履歴", href: "/vendor/posts", icon: History, description: "これまでの投稿を見返す", group: "main" },
  { label: "お店の分析", href: "/vendor/analytics", icon: BarChart3, description: "どの情報が見られているか確認", group: "main" },
  { label: "にちよさんに教える", href: "/vendor/ai-knowledge", icon: Sparkles, description: "お店のことをノートで伝える", group: "main" },
  { label: "使い方ガイド", href: "/vendor/help", icon: CircleHelp, description: "画面の見方をやさしく案内", group: "support" },
  { label: "アカウント設定", href: "/vendor/account", icon: UserRound, description: "名前やメール、パスワードの確認", group: "support" },
];
