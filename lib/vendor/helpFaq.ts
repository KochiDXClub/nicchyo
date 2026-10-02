/**
 * 出店者向けのよくある質問。
 *
 * /vendor/help の画面と、出店者トップのにちよさんへの相談（/api/vendor/help-chat）の
 * 両方がここを読む。にちよさんは、ここに書いてあることを頼りに使い方の質問に答えるので、
 * 画面の機能が変わったらここも直す（書いていないことは、にちよさんも答えられない）。
 *
 * 来訪者向けの FAQ（content/site-copy/faq.json、スプレッドシート管理）とは別物。
 * こちらは画面の変更に合わせて直すため、コードで持つ。
 */

export type VendorFaqCategory = "start" | "store" | "post" | "schedule" | "numbers" | "nichiyo" | "trouble";

export const VENDOR_FAQ_CATEGORIES: readonly { id: VendorFaqCategory; label: string }[] = [
  { id: "start", label: "はじめに" },
  { id: "store", label: "店舗情報" },
  { id: "post", label: "近況" },
  { id: "schedule", label: "お休み・出店日" },
  { id: "numbers", label: "数字" },
  { id: "nichiyo", label: "にちよさん" },
  { id: "trouble", label: "困ったとき" },
];

export type VendorFaqItem = {
  id: string;
  category: VendorFaqCategory;
  q: string;
  a: string;
  /** 答えのあとに出す「その画面を開く」リンク。lib/vendor/helpPages.ts にある画面だけ */
  href?: string;
};

export const VENDOR_FAQ: readonly VendorFaqItem[] = [
  {
    id: "start-first",
    category: "start",
    q: "最初に何をしたらいいですか？",
    a: "①店舗情報で店の写真と営業時間を入れる、②今週の商品を入れる、③近況をひとつ出してみる、の順がおすすめです。店舗情報の項目は、にちよさんに話しかけて入れることもできます。",
    href: "/vendor/store",
  },
  {
    id: "start-chat",
    category: "start",
    q: "にちよさんに話しかけて、何ができますか？",
    a: "出店者トップで、営業時間・支払い方法・雨の日の出店・Instagram/X/webサイト・今週の商品・店名・お店のこだわりを変えたいと伝えると、にちよさんが変更案を出します。「これでええかえ？」の確認で内容を直して保存するまでは、お店の情報は変わりません。写真・カテゴリ・主な商品と価格・出店日などは、画面から変えます。",
    href: "/my-shop",
  },
  {
    id: "start-menu",
    category: "start",
    q: "どの画面で何ができますか？",
    a: "近況を出す＝今日のおすすめや売り切れを伝える。店舗情報を更新＝商品・写真・出店日などを直す。投稿履歴＝過去の投稿を見返して出し直す。お店の分析＝見られた回数やお客さんの質問を見る。運営・市役所との連絡＝お知らせを見る、質問や相談を送る。メニューの「にちよさんの覚えごと」「アカウント設定」もあります。",
  },
  {
    id: "store-where",
    category: "store",
    q: "お店の情報はどこで直せますか？",
    a: "「店舗情報を更新」で、お店の顔（写真・店名・カテゴリ・スタイル・オーナー）、品ぞろえ（今週の商品・主な商品・看板商品）、出店のこと（営業時間・出店日・雨の日・支払い）、つながり（Instagram・X・webサイト）、こだわりに分かれています。直したい項目を押して入力します。",
    href: "/vendor/store",
  },
  {
    id: "store-hours-payment",
    category: "store",
    q: "営業時間や支払い方法は、画面を開かずに直せますか？",
    a: "はい。出店者トップでにちよさんに「営業時間を9時から15時にしたい」「PayPayも使えるようにしたい」のように伝えると、変更案が出ます。中身を確かめて保存すると反映されます。",
    href: "/my-shop",
  },
  {
    id: "store-photo",
    category: "store",
    q: "お店の写真や看板商品の写真を変えたい",
    a: "写真は、にちよさんとの会話では変えられません。「店舗情報を更新」の「お店の顔」「品ぞろえ」から入れ替えてください。",
    href: "/vendor/store",
  },
  {
    id: "store-weekly",
    category: "store",
    q: "「今週の商品」と「主な商品」は何が違いますか？",
    a: "「主な商品」はお店の定番、「今週の商品」はその週に出すものです。今週の商品は、にちよさんに話しかけて入れ替えることもできます。",
    href: "/vendor/store",
  },
  {
    id: "post-how",
    category: "post",
    q: "近況はどうやって出しますか？",
    a: "「近況を出す」で写真を撮るか選びます。ひとことは無くても出せますが、写真は必須です。出している間は、近況とマップのお店に表示されます。",
    href: "/vendor/post/new",
  },
  {
    id: "post-period",
    category: "post",
    q: "近況はいつまで見えますか？",
    a: "出すときに「日曜まで」「1時間だけ」「時間を決める」から選びます。期間が過ぎた投稿は自動で見えなくなります。",
    href: "/vendor/post/new",
  },
  {
    id: "post-again",
    category: "post",
    q: "前に出した近況をもう一度出したい",
    a: "「投稿履歴」で、期限切れの投稿の「そのまま再投稿」を押すと、そのままもう一度出せます。写真とひとことを直したいときは「編集して再投稿」を押してください。",
    href: "/vendor/posts",
  },
  {
    id: "schedule-closed",
    category: "schedule",
    q: "今週は休みます。どこで知らせますか？",
    a: "「出店カレンダー」で、お休みする日曜日を登録します。登録しておくと、お客さんに正しく伝わります。",
    href: "/my-shop/schedule",
  },
  {
    id: "schedule-rain",
    category: "schedule",
    q: "雨の日は出ない場合、どう設定しますか？",
    a: "出店者トップでにちよさんに「雨の日は出ません」と伝えると、変更案が出ます。店舗情報の「出店のこと」からも直せます。その日だけ休むときは、出店カレンダーでお休みを登録してください。",
    href: "/my-shop",
  },
  {
    id: "numbers-views",
    category: "numbers",
    q: "「お店が見られた回数」は、どう数えていますか？",
    a: "地図やお店のページが開かれた回数です。お客さんが同じタブでお店を開き直した分は1回と数え、自分で開いた分は数えません。先週との違いも出ます。まだ数字がないときは、日曜市のあとにまた見てください。",
    href: "/vendor/analytics",
  },
  {
    id: "numbers-timing",
    category: "numbers",
    q: "いつ近況を出すと見てもらえますか？",
    a: "「お店の分析」の「いつ、どこから見られた？」に、いちばん見られた時間帯と、見られた場所（地図・検索・QRや共有リンク）が出ます。見られる時間に合わせて出すと届きやすくなります。数字があるのは、見られた回数が記録されてからです。",
    href: "/vendor/analytics",
  },
  {
    id: "numbers-questions",
    category: "numbers",
    q: "お客さんがにちよさんに聞いたことは見られますか？",
    a: "「お店の分析」の「お客さんが気になっていること」で、お客さんがにちよさんに聞いたことを、「いま、探されているもの」で探されている言葉を見られます。次に何を出すかの参考になります。よく聞かれることは、にちよさんに覚えさせておくとそのまま伝わります。",
    href: "/vendor/analytics",
  },
  {
    id: "nichiyo-memory",
    category: "nichiyo",
    q: "お客さんに伝えてほしいことを、にちよさんに覚えさせたい",
    a: "出店者トップで、混む時間・おすすめの食べ方・取り置きができるか、のようなことを話すと、にちよさんが「覚えちょいてもかまん？」と聞きます。自分で書いて覚えさせることもできます。",
    href: "/vendor/ai-knowledge",
  },
  {
    id: "nichiyo-edit",
    category: "nichiyo",
    q: "にちよさんが覚えたことを、見たり直したりしたい",
    a: "「にちよさんの覚えごと」で見られます。直したり、忘れさせたりもできます。お客さんへの案内に使うか、自分の相談だけに使うかは、1つずつ選べます。",
    href: "/vendor/ai-knowledge",
  },
  {
    id: "trouble-contact",
    category: "trouble",
    q: "運営や市役所に聞きたいことがあります",
    a: "「運営・市役所との連絡」から、質問・報告・相談を送れます。お知らせもここで見られます。出店場所・出店料・契約のことは、運営の判断が要るので、こちらから聞いてください。",
    href: "/vendor/inquiries",
  },
  {
    id: "trouble-bug",
    category: "trouble",
    q: "画面がおかしい、うまく動かない",
    a: "「運営・市役所との連絡」から、どの画面で何をしたらどうなったかを送ってください。分かる範囲で、画面の写真があると助かります。",
    href: "/vendor/inquiries",
  },
  {
    id: "trouble-account",
    category: "trouble",
    q: "名前・メールアドレス・パスワードを変えたい",
    // アカウント設定の変更は一時的に無効（app/vendor/account/page.tsx の SAVE_DISABLED）。有効に戻したらここも直す
    a: "「アカウント設定」の変更機能は、いまは準備中で使えません（ログアウトはできます）。変えたいときは「運営・市役所との連絡」から運営に伝えてください。アカウントの削除も同じです。",
    href: "/vendor/account",
  },
];
