/**
 * 出店者の相談（にちよさん）で案内してよい画面の一覧。
 *
 * にちよさんには、ここにある名前と URL で `[近況投稿ページ](/vendor/post/new)` のように
 * 書かせる。出店者は URL を見てもどの画面か分からないため、画面ではリンクの文字を
 * 名前にして出す。ここに無い URL へのリンクは、画面側でリンクにしない。
 */
export type VendorHelpPage = {
  /** 出店者に見せる画面の名前 */
  name: string;
  href: string;
  /** その画面でできること（にちよさんがどの画面を案内するか選ぶため） */
  about: string;
};

export const VENDOR_HELP_PAGES: readonly VendorHelpPage[] = [
  { name: "近況投稿ページ", href: "/vendor/post/new", about: "今日のおすすめや売り切れなど、最新情報を投稿する" },
  { name: "投稿履歴ページ", href: "/vendor/posts", about: "これまでの投稿を見返す" },
  {
    name: "店舗情報ページ",
    href: "/vendor/store",
    about: "店名・写真・ジャンル・主な商品・出店日・支払い方法・SNS などを直す",
  },
  { name: "出店カレンダーページ", href: "/my-shop/schedule", about: "お休みする日曜日を登録する" },
  { name: "お店の分析ページ", href: "/vendor/analytics", about: "お店の情報がどれくらい見られているかを見る" },
  { name: "AIに教えるページ", href: "/vendor/ai-knowledge", about: "お店のことをAI（にちよさん）に教える" },
  { name: "使い方ガイドページ", href: "/vendor/help", about: "出店者向けの画面の使い方を読む" },
  { name: "アカウント設定ページ", href: "/vendor/account", about: "名前・メールアドレス・パスワードを確かめる" },
];

/** 案内してよい画面なら、その画面を返す（末尾の `/` は無視する） */
export function findVendorHelpPage(href: string): VendorHelpPage | null {
  const path = href.trim().replace(/\/+$/, "") || "/";
  return VENDOR_HELP_PAGES.find((page) => page.href === path) ?? null;
}
