/**
 * トップページ（/）の文言と写真。
 *
 * 日曜市の数字（毎週日曜・約1.3km・およそ300の店）と相談の見本は、マップの案内（mapIntro.*）と
 * 同じ文言をシートから読む（docs/SITE_COPY.md）。ここにある文言は、まだシートに載っていないもの。
 * 写真を差し替えるときは、ここのパスと大きさ（width / height）だけを直す。
 */

import type { Shop } from "../map/data/shops";

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

/** 日曜市の良いところ。写真が主役で、文章は短く添える */
export const HIGHLIGHTS: { label: string; title: string; body: string; photo: LandingPhoto }[] = [
  {
    label: "HISTORY",
    title: "300年以上続く、街なかの市",
    body: "江戸時代から続く高知の日曜市。高知城のふもとの追手筋に、毎週日曜、およそ300の店が約1.3kmにわたって並びます。",
    photo: PHOTOS.overview,
  },
  {
    label: "PEOPLE",
    title: "つくった人と話しながら、買える",
    body: "朝どれの野菜や果物、田舎寿司。店先で食べ方を聞けば、つくった人がそのまま教えてくれます。",
    photo: PHOTOS.produce,
  },
  {
    label: "WALK",
    title: "歩くだけで、出会いがある",
    body: "芋天を片手に、刃物、植木、骨董、手しごとの品へ。のぞくたびに、ちがう店と人に出会えます。",
    photo: PHOTOS.crowd,
  },
];

/** 開催の案内。休市日は高知市の案内による（1月1・2日と、よさこい祭りの8月10〜12日に日曜が重なる日は休み） */
export const MARKET_FACTS: { term: string; detail: string }[] = [
  { term: "いつ", detail: "毎週日曜。早朝から夕方まで（店によって違います）。品ぞろえが多いのは午前中" },
  { term: "どこ", detail: "高知城のふもとから、追手筋（高知市）の東の端まで" },
  { term: "お休み", detail: "1月1・2日と、8月10〜12日（よさこい祭り）に重なる日曜" },
];

/** メッセージ。開発チーム（高知高専）からのことば */
export const MESSAGE = {
  title: ["日曜市を、", "つぎの300年へ。"],
  paragraphs: [
    "わたしたちは、高知工業高等専門学校の学生です。日曜市に通い、出店者さんや来てくれた人の声を聞きながら、nicchyo をつくっています。",
    "はじめての人が迷わず歩けて、出店者さんの思いがもっと伝わる。300年続いてきたこの市が、これからも続いていくように、デジタルの力で支えていきたいと考えています。",
  ],
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
