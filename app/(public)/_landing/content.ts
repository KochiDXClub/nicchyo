/**
 * トップページ（/）の文言と写真。
 *
 * 日曜市の数字（毎週日曜・約1.3km・およそ300の店）と相談の見本は、マップの案内（mapIntro.*）と
 * 同じ文言をシートから読む（docs/SITE_COPY.md）。ここにある文言は、まだシートに載っていないもの。
 * 写真を差し替えるときは、ここのパスと大きさ（width / height）だけを直す。
 */

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

/** にちよさんが着地するセクション。<section data-grandma-section> と着地点（GrandmaPerch）に付ける */
export type LandingSectionKey = "hero" | "about" | "highlights" | "shop" | "consult" | "message";

/**
 * 右下にいるときのにちよさんのひとこと。いま読んでいるセクションに合わせて変える。
 * 案内の口調（mapIntro.*）にそろえて土佐ことばで書く。最後は見送りの一言（シート）を使う
 */
export const GRANDMA_COMMENTS: Record<Exclude<LandingSectionKey, "message">, string> = {
  hero: "ようこそ、日曜市へ。下へ進んでみいや。",
  about: "nicchyo はね、高知高専の学生さんがつくったがよ。",
  highlights: "朝早いほど品ぞろえがえいき、早めに来てね。",
  shop: "気になる店は、地図で押してみいや。中が見えるき。",
  consult: "わからんことは、わしに聞きや。押したら相談できるき。",
};
