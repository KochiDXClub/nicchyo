// 出店者ナビの唯一の権威ある導線リスト。
// VendorNavBar（下部バーのメニューシート）と VendorSidebar（PC）の両方が
// これを参照することで、項目の食い違いを防ぐ。

export type VendorNavItem = {
  label: string;
  href: string;
  emoji: string;
  description: string;
};

export const VENDOR_NAV_ITEMS: VendorNavItem[] = [
  { label: "店舗情報を更新", href: "/vendor/store", emoji: "🛠️", description: "商品・写真・出店日をまとめて見直す" },
  { label: "最新情報を発信", href: "/vendor/post/new", emoji: "📣", description: "今日のおすすめや売り切れを伝える" },
  { label: "投稿履歴", href: "/vendor/posts", emoji: "📮", description: "これまでの投稿を見返す" },
  { label: "お店の分析", href: "/vendor/analytics", emoji: "📈", description: "どの情報が見られているか確認" },
  { label: "AIに教える", href: "/vendor/ai-knowledge", emoji: "✨", description: "お店のことをAIに伝える" },
  { label: "使い方ガイド", href: "/vendor/help", emoji: "❓", description: "画面の見方をやさしく案内" },
  { label: "アカウント設定", href: "/vendor/account", emoji: "👤", description: "名前やメール、パスワードの確認" },
];
