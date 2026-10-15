import Image from "next/image";
import { ChevronDown, Clock, Expand, Heart, Instagram, Search, Send, Share2, Umbrella, X } from "lucide-react";
import { getShopBannerImage } from "@/lib/shopImages";
import { DEFAULT_CONSULT_CHARACTER } from "../consult/data/consultCharacters";
import { SHOP_CATEGORY_NAMES, getShopCategoryColor, resolveStallColors, type ShopCategory } from "../map/config/shopCategories";
import {
  STALL_AWNING_PATTERNS,
  STALL_PHOTO_HEIGHT_RATIO,
  STALL_ROOF_SHAPES,
  generateStallSpriteSvg,
  resolveStallParts,
} from "../map/config/stallParts";
import { STATE_COLORS } from "../map/components/maplibre/stallSprites";
import { SAMPLE_SHOP } from "./content";
import PhotoScrim from "./PhotoScrim";

/**
 * 「nicchyoの使い方！」の、動く3つのスマホ画面。
 * どれも、本番の画面の形と部品（屋台は地図と同じ generateStallSpriteSvg、バナーと相談は本番の並び・文言）に
 * 合わせた**見本**で、本物の地図・バナー・AI は動かさない（表示の負担と、AI の利用料を増やさないため）。
 * 動きは CSS の transform / opacity だけ。画面の外では止める（InView）。「動きを減らす」設定では、結果の形で止める
 */

// ── 1. 地図でさがす ─────────────────────────────────────────

const STALL_WIDTH = 50;
const STALL_HEIGHT = STALL_WIDTH * STALL_PHOTO_HEIGHT_RATIO;

/** 検索で残った屋台の色（地図の検索状態＝青）。地図と同じ値を使う */
const SEARCH_STALL = { roof: STATE_COLORS.search.roof, awningBase: STATE_COLORS.search.base, awningStripe: STATE_COLORS.search.stripe } as const;

/** 地図の屋台と同じ絵（写真入り）。カテゴリの既定の写真を入れる */
function stallSvg(category: ShopCategory, index: number, search = false, photoSeed = index): string {
  const stall = resolveStallColors(category);
  const photo = getShopBannerImage(category, photoSeed);
  return generateStallSpriteSvg(
    resolveStallParts({ roof: STALL_ROOF_SHAPES[index % STALL_ROOF_SHAPES.length], awning: STALL_AWNING_PATTERNS[index % STALL_AWNING_PATTERNS.length] }),
    search
      ? { ...SEARCH_STALL, photo: { href: photo, stroke: SEARCH_STALL.roof } }
      : { roof: stall.base, awningBase: stall.light, awningStripe: stall.base, photo: { href: photo, stroke: stall.dark } },
    { width: STALL_WIDTH, height: STALL_HEIGHT }
  );
}

/** 道の左右に並べる屋台（1行2軒）。2番目（右上）が「芋天」で残る屋台 */
const MAP_ROWS: ShopCategory[] = ["食材", "食べ物", "道具・工具", "手作り・工芸", "植物・苗", "アクセサリー", "生活雑貨", "食材", "アクセサリー", "道具・工具", "手作り・工芸", "植物・苗"];
const HIT_INDEX = 1;
const SEARCH_WORD = "芋天";

export function MapScreen() {
  return (
    <div className="landing-screen">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 230 452" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <rect className="landing-map-ground" width="230" height="452" />
        <rect className="landing-map-road" x="60" width="110" height="452" />
        <rect className="landing-map-edge" x="60" width="3" height="452" />
        <rect className="landing-map-edge" x="167" width="3" height="452" />
        <line className="landing-dash landing-map-dash" x1="115" y1="0" x2="115" y2="452" strokeWidth="3" strokeDasharray="14 10" />
        {MAP_ROWS.map((category, index) => {
          const x = index % 2 === 0 ? 8 : 172;
          const y = 108 + Math.floor(index / 2) * 56;
          if (index === HIT_INDEX) {
            return (
              <g key={index} transform={`translate(${x} ${y})`}>
                {/* CSS の transform（跳ねる動き）が位置の transform を上書きしないよう、位置と動きの g を分ける */}
                <g className="landing-m-hit">
                  <g dangerouslySetInnerHTML={{ __html: stallSvg(category, index, false, 0) }} />
                  <g className="landing-m-blue" dangerouslySetInnerHTML={{ __html: stallSvg(category, index, true, 0) }} />
                </g>
              </g>
            );
          }
          return (
            <g key={index} transform={`translate(${x} ${y})`}>
              <g className="landing-m-dim" dangerouslySetInnerHTML={{ __html: stallSvg(category, index) }} />
            </g>
          );
        })}
      </svg>
      <div className="landing-m-search">
        <Search aria-hidden className="h-3.5 w-3.5 shrink-0" />
        <span className="landing-typed">{SEARCH_WORD}</span>
        <i className="landing-caret" />
      </div>
      <div className="landing-m-chips">
        {SHOP_CATEGORY_NAMES.slice(0, 3).map((name) => (
          <span key={name} className={name === "食べ物" ? "landing-on" : undefined}>
            {name}
          </span>
        ))}
      </div>
      <div className="landing-m-card">
        <span className="landing-m-ph" style={{ borderColor: getShopCategoryColor("食べ物") }}>
          <Image src={getShopBannerImage("食べ物", 0)} alt="" width={64} height={64} className="h-full w-full object-cover" />
        </span>
        <span>
          <b>{SEARCH_WORD}のお店</b>
          <small>食べ物・8:00〜14:00</small>
        </span>
      </div>
    </div>
  );
}

// ── 2. お店をひらく ───────────────────────────────────────────

function formatPrice(price: number | null | undefined) {
  return price == null ? "価格は現地で確認" : `¥${price.toLocaleString()}`;
}

export function BannerScreen() {
  const shop = SAMPLE_SHOP;
  const hours = `${shop.businessHoursStart} 〜 ${shop.businessHoursEnd}`;
  const products = [shop.products[0], shop.products[2]].filter((name): name is string => Boolean(name));
  const photo = "/images/landing/candle-shop.webp";
  return (
    <div className="landing-screen">
      <div className="landing-dimmer absolute inset-0" />
      <div className="landing-sheet">
        {/* ちらっと見える小さなバナー（本番の「引き上げる前」の形） */}
        <div className="landing-peek">
          <div className="flex justify-center pb-0.5 pt-1.5">
            <span className="h-[5px] w-[34px] rounded-full bg-nicchyo-ink/20" />
          </div>
          <span className="landing-peek-x">
            <X aria-hidden className="h-3 w-3" />
          </span>
          <div className="landing-peek-row">
            <span className="landing-peek-ph">
              <Image src={photo} alt="" width={112} height={112} className="h-full w-full object-cover" />
            </span>
            <span className="landing-peek-t">
              <span className="landing-chip">{shop.category}</span>
              <b>{shop.name}</b>
              <small>手づくりの灯り</small>
              <span className="landing-peek-c">
                {products.map((name) => (
                  <span key={name}>{name}</span>
                ))}
              </span>
            </span>
          </div>
        </div>
        {/* 引き上げたあと：大きな写真・共有・お店の情報・商品 */}
        <div className="landing-detail">
          <div className="landing-dscroll">
            <div className="landing-hero2">
              <Image src={photo} alt="" width={420} height={312} className="h-full w-full object-cover" />
              <PhotoScrim />
              <span className="landing-h2-zoom">
                <Expand aria-hidden className="h-2.5 w-2.5" />
                拡大
              </span>
              <span className="landing-h2-down">
                <ChevronDown aria-hidden className="h-3.5 w-3.5" />
              </span>
              <span className="landing-h2-t">
                <em>{shop.category}</em>
                <b>{shop.name}</b>
                <small>手づくりの灯り</small>
              </span>
              <span className="landing-heart">
                <Heart aria-hidden className="h-3.5 w-3.5" />
                <span className="landing-heart-on">
                  <Heart aria-hidden className="h-3.5 w-3.5" fill="currentColor" />
                </span>
              </span>
            </div>
            <span className="landing-share">
              <Share2 aria-hidden className="h-3 w-3" />
              共有
            </span>
            <div className="landing-info">
              <p>
                <Clock aria-hidden className="h-3 w-3" />
                <span>出店時間</span>
                <b>{hours}</b>
              </p>
              <p>
                <Umbrella aria-hidden className="h-3 w-3" />
                <span>雨の日</span>
                <b>{shop.rainPolicy === "cancel" ? "雨天中止" : "雨でも出店"}</b>
              </p>
              <p className="landing-more">
                もっと見る <ChevronDown aria-hidden className="h-3 w-3" />
              </p>
              <p className="landing-ig">
                <span>
                  <Instagram aria-hidden className="h-3 w-3" />
                  Instagram
                </span>
              </p>
            </div>
            <div className="landing-ph-head">
              <b>商品</b>
              <span>
                <Heart aria-hidden className="h-2.5 w-2.5" />
                お気に入り
              </span>
            </div>
            <div className="landing-pgrid">
              {products.map((name, i) => (
                <span key={name} className="landing-pc">
                  <span className="landing-pc-ph">
                    <Image src={photo} alt="" width={160} height={160} className="h-full w-full object-cover" style={{ objectPosition: i === 0 ? "12% 50%" : "88% 50%" }} />
                    <i>
                      <Heart aria-hidden className="h-[11px] w-[11px]" />
                    </i>
                  </span>
                  <b>{name}</b>
                  <small>{formatPrice(shop.productPrices?.[name])}</small>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 3. にちよさんに聞く ───────────────────────────────────────

const ASK = {
  suggestion: "おすすめのランチは？",
  answer: "歩きながら食べるなら、芋天がええよ。朝のうちが揚げたてじゃ。",
  other: ["今の旬の果物は？", "はじめてでも大丈夫？"],
  placeholder: "（例）今の旬の果物は？",
};

/** 紹介されるお店のカード（本番の ConsultShopCard と同じ：上に写真とカテゴリ、下に店名・商品・「くわしく見る」）。カテゴリの既定の写真を使う */
const ASK_SHOPS: { name: string; category: ShopCategory; chips: string[]; seed: number }[] = [
  { name: "芋天のお店", category: "食べ物", chips: ["芋天"], seed: 0 },
  { name: "アイスのお店", category: "食べ物", chips: ["アイス"], seed: 1 },
];

export function ConsultScreen() {
  const speaker = DEFAULT_CONSULT_CHARACTER;
  return (
    <div className="landing-screen landing-consult">
      <div className="landing-c-back">‹ マップにもどる</div>
      <div className="landing-c-av">
        <Image src={speaker.image} alt="" width={68} height={68} className="h-[68px] w-[68px] object-contain" />
      </div>
      <div className="landing-cA">
        <p className="landing-c-greet">
          <b>なんでも聞いてや。</b>
          <small>聞きたいことを選んでね。</small>
        </p>
        <div className="landing-c-sugs">
          <span className="landing-sug landing-sug1">
            {ASK.suggestion}
            <i className="landing-tap" />
          </span>
          {ASK.other.map((text) => (
            <span key={text} className="landing-sug">
              {text}
            </span>
          ))}
        </div>
      </div>
      <div className="landing-cB">
        <p className="landing-q">{ASK.suggestion}</p>
        <p className="landing-who">{speaker.name}</p>
        <div className="landing-ans-wrap">
          <div className="landing-skel">
            <i />
            <i />
            <i />
          </div>
          <p className="landing-ans">{ASK.answer}</p>
        </div>
        <div className="landing-cards">
          <p className="landing-cl">おすすめのお店 {ASK_SHOPS.length}件</p>
          <div className="landing-mcs">
            {ASK_SHOPS.map((shop) => (
              <span key={shop.name} className="landing-mc">
                <span className="landing-mc-ph">
                  <Image src={getShopBannerImage(shop.category, shop.seed)} alt="" width={160} height={80} className="h-full w-full object-cover" />
                  <em>{shop.category}</em>
                </span>
                <span className="landing-mc-b">
                  <b>{shop.name}</b>
                  <span className="landing-mc-c">
                    {shop.chips.map((chip) => (
                      <span key={chip}>{chip}</span>
                    ))}
                  </span>
                  <small>くわしく見る →</small>
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="landing-c-bar">
        <span>{ASK.placeholder}</span>
        <i>
          <Send aria-hidden className="h-[13px] w-[13px] text-white" />
        </i>
      </div>
    </div>
  );
}
