/**
 * トップページ（/）の文言と写真。
 *
 * 文言はスプレッドシートの「トップページ」タブ（landing.*）から読む（docs/SITE_COPY.md）。
 * ここには、文言が「どの写真・どの順番・どのリンクか」と、写真のパスと大きさだけを置く。
 * 写真を差し替えるときは、ここのパスと大きさ（width / height）だけを直す。
 */

import type { SiteTextKey } from "@/lib/siteCopy";
import { SHOP_CATEGORY_NAMES, type ShopCategory } from "../map/config/shopCategories";

/** カテゴリごとのイラスト（public/images/landing/art/）。カテゴリを足したら、ここに絵を足す（型で漏れに気づける） */
const GENRE_ART: Record<ShopCategory, string> = {
  食材: "/images/landing/art/genre-shokuzai.svg",
  食べ物: "/images/landing/art/genre-tabemono.svg",
  "道具・工具": "/images/landing/art/genre-dougu.svg",
  生活雑貨: "/images/landing/art/genre-zakka.svg",
  "植物・苗": "/images/landing/art/genre-shokubutsu.svg",
  アクセサリー: "/images/landing/art/genre-accessory.svg",
  "手作り・工芸": "/images/landing/art/genre-tezukuri.svg",
};

export type LandingPhoto = { src: string; width: number; height: number };

export const PHOTOS = {
  overview: {
    src: "/images/intro/sunday-market-otepia-overview.webp",
    width: 960,
    height: 1280,
  },
  stalls: {
    src: "/images/intro/sunday-market-street-stalls.webp",
    width: 1280,
    height: 960,
  },
  crowd: {
    src: "/images/intro/sunday-market-street-crowd.webp",
    width: 1280,
    height: 960,
  },
  produce: {
    src: "/images/home-hero.jpg",
    width: 1191,
    height: 941,
  },
  survey: {
    src: "/images/activities/2025-10-19-sunday-market-survey.webp",
    width: 2344,
    height: 1758,
  },
} satisfies Record<string, LandingPhoto>;

/** 日曜市のいいところ。写真が主役で、写真の上に書かれる短い手描きの一言（と、ひとつのシール）を重ねる */
export const HIGHLIGHTS: { id: string; title: SiteTextKey; photoAlt: SiteTextKey; sticker: string; photo: LandingPhoto; delay: number }[] = [
  { id: "history", title: "landing.highlights.history.title", photoAlt: "landing.highlights.history.photoAlt", sticker: "/images/landing/art/sticker-year.svg", photo: PHOTOS.overview, delay: 0.15 },
  { id: "people", title: "landing.highlights.people.title", photoAlt: "landing.highlights.people.photoAlt", sticker: "/images/landing/art/sticker-talk.svg", photo: PHOTOS.produce, delay: 0.45 },
  { id: "walk", title: "landing.highlights.walk.title", photoAlt: "landing.highlights.walk.photoAlt", sticker: "/images/landing/art/sticker-face.svg", photo: PHOTOS.crowd, delay: 0.75 },
];

/**
 * ジャンルの入口。店舗カテゴリ（map/config/shopCategories.ts の SHOP_CATEGORY_NAMES）7つそのまま。
 * 押すと、地図をそのカテゴリで絞り込んでひらく（/map?category=カテゴリ名）。
 * 絵は public/images/landing/art/ のイラスト（屋台のカテゴリ色は getShopCategoryColor から取る）
 */
export const GENRES: { category: ShopCategory; art: string }[] = SHOP_CATEGORY_NAMES.map((category) => ({
  category,
  art: GENRE_ART[category],
}));

/**
 * 開催の案内（いつ・どこ）。
 * 休市日は高知市の案内による（1月1・2日と、よさこい祭りの8月10〜12日に日曜が重なる日は休み）。
 * 休みの日は、開催カレンダー（market_days）に登録された状態として「これからの日曜」に出る
 */
export const MARKET_FACTS: { id: "when" | "where"; label: SiteTextKey; detail: SiteTextKey }[] = [
  { id: "when", label: "landing.info.when.label", detail: "landing.info.when.detail" },
  { id: "where", label: "landing.info.where.label", detail: "landing.info.where.detail" },
];

/**
 * 「お店をひらく」で開いて見せる見本の店。写真は日曜市で撮ったキャンドルのお店。
 *
 * 地図で店を押すと何が分かるかを見せるための見本で、出店時間などの値は見本として置いている。
 * 実在の店の情報として扱わない。店名・商品名はシートの文言（landing.howTo.banner.*）。
 * 値段は写真に写っている札（250円・900円）に合わせる
 */
export const SAMPLE_SHOP: {
  category: ShopCategory;
  businessHoursStart: string;
  businessHoursEnd: string;
  rainPolicy: "cancel" | "open";
  products: { name: SiteTextKey; price: number }[];
} = {
  category: "手作り・工芸",
  businessHoursStart: "7:00",
  businessHoursEnd: "14:00",
  rainPolicy: "cancel",
  products: [
    { name: "landing.howTo.banner.product1", price: 250 },
    { name: "landing.howTo.banner.product2", price: 900 },
  ],
};
