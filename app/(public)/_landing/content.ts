/**
 * トップページ（/）の文言と写真。
 *
 * 日曜市の数字（毎週日曜・約1.3km・およそ300の店）と相談の見本は、マップの案内（mapIntro.*）と
 * 同じ文言をシートから読む（docs/SITE_COPY.md）。ここにある文言は、まだシートに載っていないもの。
 * 写真を差し替えるときは、ここのパスと大きさ（width / height）だけを直す。
 */

import type { Shop } from "../map/data/shops";
import type { ShopCategory } from "../map/config/shopCategories";

export type LandingPhoto = { src: string; width: number; height: number; alt: string };

export const PHOTOS = {
  overview: {
    src: "/images/intro/sunday-market-otepia-overview.webp",
    width: 960,
    height: 1280,
    alt: "上から見た日曜市。並木道に沿って、屋台のテントがずっと先まで続いている",
  },
  stalls: {
    src: "/images/intro/sunday-market-street-stalls.webp",
    width: 1280,
    height: 960,
    alt: "のぼりとテントの屋台が並ぶ、追手筋の日曜市",
  },
  crowd: {
    src: "/images/intro/sunday-market-street-crowd.webp",
    width: 1280,
    height: 960,
    alt: "買い物客でにぎわう日曜市の通り",
  },
  produce: {
    src: "/images/home-hero.jpg",
    width: 1191,
    height: 941,
    alt: "野菜や品物が並ぶ、日曜市の屋台",
  },
  survey: {
    src: "/images/activities/2025-10-19-sunday-market-survey.webp",
    width: 2344,
    height: 1758,
    alt: "日曜市で来訪者アンケートをする、高知高専の学生たち",
  },
} satisfies Record<string, LandingPhoto>;

/** 日曜市のいいところ。写真が主役で、文字は写真に重ねる短い見出しだけにする */
export const HIGHLIGHTS: { label: string; title: string; photo: LandingPhoto }[] = [
  { label: "HISTORY", title: "300年以上続く市", photo: PHOTOS.overview },
  { label: "PEOPLE", title: "つくった人から買える", photo: PHOTOS.produce },
  { label: "WALK", title: "歩くだけで出会える", photo: PHOTOS.crowd },
];

/**
 * ジャンルの入口。押すと、その店舗カテゴリで絞った検索（/search?q=カテゴリ名）をひらく。
 * 検索はカテゴリ名でも当たる（search/lib/searchIndex.ts の categoryLower）。
 * 見出しは来訪者に伝わる言い方にし、カテゴリ名（map/config/shopCategories.ts）とは分けて持つ
 */
export const GENRES: { label: string; category: ShopCategory }[] = [
  { label: "野菜・果物", category: "食材" },
  { label: "食べ歩き", category: "食べ物" },
  { label: "刃物・道具", category: "道具・工具" },
  { label: "植木・苗", category: "植物・苗" },
  { label: "手しごと", category: "手作り・工芸" },
  { label: "雑貨", category: "生活雑貨" },
];

/**
 * 開催の案内。長さと店の数は見出しの mapIntro.lead（シート）が持つので、ここには書かない。
 * 休市日は高知市の案内による（1月1・2日と、よさこい祭りの8月10〜12日に日曜が重なる日は休み）
 */
export const MARKET_FACTS: { term: string; detail: string }[] = [
  { term: "いつ", detail: "毎週日曜　早朝〜夕方（店によって違います）" },
  { term: "どこ", detail: "高知城のふもと〜追手筋（高知市）" },
  { term: "お休み", detail: "1/1・2、8/10〜12 に重なる日曜" },
];

/** nicchyo について。開発チーム（高知高専）からのことばは短く */
export const ABOUT = {
  body: "日曜市に通い、出店者さんや来た人の声を聞きながら開発しています。",
  award: "こうちNPOアワード2025「ワカモノ未来賞」受賞",
  message: ["日曜市を、", "つぎの300年へ。"],
  signature: "nicchyo 開発チーム（高知高専）",
};

/**
 * 「お店の紹介」で開いて見せる見本の店。写真は日曜市で撮ったキャンドルのお店。
 *
 * 地図で店を押すと何が分かるかを見せるための見本で、出店日・時間などの値は見本として置いている
 * （画面にも「見本」と出す）。実在の店の情報として扱わない。id は 0（店番が無いので店舗ページへは繋がない）。
 * 商品と値段は写真に写っている札（250円・900円）に合わせる
 */
export const SAMPLE_SHOP: Shop = {
  id: 0,
  // 地図の上の位置は使わない（バナーだけを見せる）
  position: 0,
  lat: 0,
  lng: 0,
  name: "キャンドルのお店",
  ownerName: "",
  category: "手作り・工芸",
  catchphrase: "花や多肉植物をかたどった、小さなキャンドル",
  products: ["花のキャンドル", "多肉植物のキャンドル", "キャンドルのセット"],
  productPrices: { 花のキャンドル: 250, 多肉植物のキャンドル: 250, キャンドルのセット: 900 },
  description: "",
  schedule: "毎週日曜",
  businessHoursStart: "7:00",
  businessHoursEnd: "14:00",
  rainPolicy: "cancel",
  paymentMethods: ["cash"],
  shopStrength: "ひとつずつ形をつくっています。色ちがいも並べているので、手に取って選んでみてください。",
  themeColor: "rose",
  images: { main: "/images/landing/candle-shop.webp" },
};
