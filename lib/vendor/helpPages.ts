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
  { name: "出店者トップ", href: "/my-shop", about: "にちよさんに相談して、お店の情報を会話で変える" },
  { name: "運営・市役所との連絡ページ", href: "/vendor/inquiries", about: "お知らせを見る、運営や市役所に質問・報告・相談を送る" },
  { name: "近況投稿ページ", href: "/vendor/post/new", about: "今日のおすすめや売り切れなど、最新情報を投稿する" },
  { name: "投稿履歴ページ", href: "/vendor/posts", about: "これまでの投稿を見返す" },
  {
    name: "店舗情報ページ",
    href: "/vendor/store",
    about: "店名・写真・ジャンル・主な商品・出店日・支払い方法・SNS などを直す",
  },
  { name: "出店カレンダーページ", href: "/my-shop/schedule", about: "お休みする日曜日を登録する" },
  { name: "お店の分析ページ", href: "/vendor/analytics", about: "お店が何回見られたか、お客さんが何を聞いたかを見る" },
  { name: "にちよさんが覚えちゅうことページ", href: "/vendor/ai-knowledge", about: "にちよさんが相談で覚えたお店のことを見る・直す・忘れさせる" },
  { name: "よくある質問ページ", href: "/vendor/help", about: "出店者向けのよくある質問を一覧で読む" },
  { name: "アカウント設定ページ", href: "/vendor/account", about: "お店のメンバー・招待リンク・操作ログを確かめる／退会する" },
];

/** 案内してよい画面なら、その画面を返す（末尾の `/` は無視する） */
export function findVendorHelpPage(href: string): VendorHelpPage | null {
  const path = href.trim().replace(/\/+$/, "") || "/";
  return VENDOR_HELP_PAGES.find((page) => page.href === path) ?? null;
}
