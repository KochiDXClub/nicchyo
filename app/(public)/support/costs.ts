/**
 * 協賛・ご支援のページに出す、お金にかかわる決めごと
 *
 * 運営にいくらかかっているかは出さない。サーバーとデータベースは無料の枠で
 * 続けていく方針で、金額を出しても読み手の判断材料にならず、為替や使い方で
 * 動くたびに書き換えが要るだけになる。代わりに「いただいたお金を何に使うか」を出す。
 */

export type FundUse = {
  /** 絵柄を選ぶための名前。画面側（FundUses）がこれでアイコンを決める */
  kind: "domain" | "devops" | "ai";
  /** 使い道の名前。短く */
  title: string;
  /** 何のためのお金か。1文で。金額は書かない */
  body: string;
};

/**
 * いただいたご支援の使い道。
 *
 * ここに書いた時点で、お預かりしたお金の使い方の約束になる。並べるのは主な使い道で、
 * それ以外の「続けるために必要なこと」にも使うことは、ページの側で一言添えてある。
 * 主な使い道が変わったら、ここを書き換えること。
 */
export const FUND_USES: FundUse[] = [
  {
    kind: "domain",
    title: "ドメイン代",
    body: "nicchyo.jp を保ち、配布しているQRコードからいつでも開けるようにします。",
  },
  {
    kind: "devops",
    title: "開発・運用の諸費用",
    body: "地図を動かし続け、新しい機能をつくっていくためにかかる費用です。",
  },
  {
    kind: "ai",
    title: "AIの利用料",
    body: "AI「にちよさん」の相談を動かす費用です。使っていただいた分だけかかります。",
  },
];

/**
 * 協賛1口の年額。
 *
 * 掲載の期間は1年。年に一度見直す前提で置いている（そのことはページにも書いてある）。
 * 口数は SUPPORTER_SLOT_COUNT に合わせてある。ここを書き換えたら、既にご協賛
 * くださっている方には次のご継続の相談のときにお伝えすること。黙って変えない。
 */
export const SPONSOR_UNIT_ANNUAL_JPY: number | null = 30_000;

export function formatJpy(value: number): string {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

/** ご相談の入口のボタンがどこにあるか */
export type SupportContactSource = "hero" | "floating" | "individual" | "organization";

/**
 * ご相談の入口へのリンク。
 *
 * どのボタンから来たかを from に付ける。ページの閲覧記録と GA4 は問い合わせ画面の
 * URL をクエリごと残すので、どのボタンが相談につながっているかを後から見分けられる。
 */
export function supportContactHref(from: SupportContactSource): string {
  return `/contact?category=sponsor&from=support-${from}`;
}
