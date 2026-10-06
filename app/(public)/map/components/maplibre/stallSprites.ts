/**
 * 屋台スプライトの描き起こし（MapLibre 用）
 *
 * シンボルレイヤーはビットマップしか受け付けないので、屋台パーツの SVG を
 * Canvas で一度だけ描き起こして map.addImage に登録する。
 * 画像の枚数は「形 × 色 × 状態」の組み合わせ数だが、色はカテゴリ数（十数種）、
 * 状態は normal / search / ai / selected の 4 つなので、多くても数十枚に収まる。
 * 出店者のカスタム SVG は個別に描き起こす（色は変えられない）。
 */

import { ILLUSTRATION_SIZES } from "../../config/displayConfig";
import { resolveStallColors } from "../../config/shopCategories";
import {
  generateStallSpriteSvg,
  resolveStallParts,
  STALL_BODY_RECT,
  STALL_PHOTO_HEIGHT_RATIO,
  type StallPartsSpec,
} from "../../config/stallParts";
import {
  SHOP_FAVORITE_COLOR_FALLBACK,
  SHOP_FAVORITE_HEART_PATH,
  sanitizeCssColor,
} from "../../utils/markerHtmlGenerator";
import type { Shop } from "../../data/shops";
import { memoImage } from "./rasterCache";

/**
 * 描き起こした画像の使い回し
 *
 * マップページから離れると map.remove() で MapLibre ごと捨てられるが、
 * このモジュールはページ遷移をまたいで生き続ける。屋台・建物・バッジは
 * 「形・色・状態・pixelRatio」だけで中身が決まる（＝内容アドレス）ので、
 * 一度描いたものを取っておけば再訪時の描き起こしを丸ごと省ける。
 *
 * 枚数は 形×色×状態 で数十枚に収まるため上限は緩くてよいが、
 * 端末の記憶容量を無制限には使わないよう入れた順に捨てる。
 */
export type StallState = "normal" | "search" | "ai" | "selected";
export const STALL_STATES: readonly StallState[] = ["normal", "search", "ai", "selected"];

/** 状態ごとの屋根・ひさし色（globals.css の状態上書きと同じ値） */
const STATE_COLORS: Record<Exclude<StallState, "normal" | "selected">, { roof: string; base: string; stripe: string }> = {
  search: { roof: "#2563eb", base: "#93c5fd", stripe: "#2563eb" },
  ai: { roof: "#ef4444", base: "#fca5a5", stripe: "#ef4444" },
};

/** 店舗ごとの「形＋色」のキー。同じキーの店舗は同じ画像を共有する */
export function stallSpriteKey(shop: Shop): string {
  const parts = resolveStallParts({ roof: shop.illustration?.roof, awning: shop.illustration?.awning });
  const color = resolveStallColors(shop.category, sanitizeCssColor(shop.illustration?.color)).base;
  return `${parts.roof}-${parts.awning}-${color.replace("#", "")}`;
}

export function stallImageId(spriteKey: string, state: StallState): string {
  return `stall:${spriteKey}:${state}`;
}

interface SpriteRecipe {
  parts: StallPartsSpec;
  baseColor: string;
}

function recipeFor(shop: Shop): SpriteRecipe {
  return {
    parts: resolveStallParts({ roof: shop.illustration?.roof, awning: shop.illustration?.awning }),
    baseColor: resolveStallColors(shop.category, sanitizeCssColor(shop.illustration?.color)).base,
  };
}

function svgForState(
  recipe: SpriteRecipe,
  state: StallState,
  px: number,
  photoHref?: string,
  heightPx = px
): string {
  const stall = resolveStallColors(undefined, recipe.baseColor);
  if (state === "normal" || state === "selected") {
    return generateStallSpriteSvg(
      recipe.parts,
      {
        roof: stall.base,
        awningBase: stall.light,
        awningStripe: stall.base,
        outline: state === "selected" ? "#fbbf24" : undefined,
        // 写真の縁はカテゴリ色。選ぶと黄色に変わる
        photo: photoHref ? { href: photoHref, stroke: state === "selected" ? "#fbbf24" : stall.dark } : undefined,
      },
      { width: px, height: heightPx }
    );
  }
  const c = STATE_COLORS[state];
  return generateStallSpriteSvg(
    recipe.parts,
    {
      roof: c.roof,
      awningBase: c.base,
      awningStripe: c.stripe,
      photo: photoHref ? { href: photoHref, stroke: c.roof } : undefined,
    },
    { width: px, height: heightPx }
  );
}

/**
 * SVG 文字列をビットマップに描き起こす（pixelRatio 倍で描いて高解像度画面でも鮮明にする）。
 * 縦長の絵（人影など）は heightPx を渡す。省略時は px の正方形。
 */
export async function rasterizeSvg(
  svg: string,
  px: number,
  pixelRatio: number,
  heightPx = px
): Promise<ImageData> {
  // data URL で読む（blob: だと環境によって SVG の読み込みに失敗することがある）
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const img = new Image();
  img.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("stall sprite の描き起こしに失敗しました"));
    img.src = url;
  });
  const width = Math.round(px * pixelRatio);
  const height = Math.round(heightPx * pixelRatio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context を取得できません");
  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/**
 * 任意の画像 URL（SVG を含む）を、表示幅 widthPx × pixelRatio のビットマップに描き起こす。
 * MapLibre の loadImage は SVG を読めないので、ランドマーク画像はこちらで読む。
 */
export function rasterizeImageUrl(
  url: string,
  widthPx: number,
  pixelRatio: number
): Promise<ImageData> {
  return memoImage(`url:${url}@${widthPx}x${pixelRatio}`, () =>
    rasterizeImageUrlUncached(url, widthPx, pixelRatio)
  );
}

async function rasterizeImageUrlUncached(
  url: string,
  widthPx: number,
  pixelRatio: number
): Promise<ImageData> {
  const img = new Image();
  img.decoding = "async";
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`画像の読み込みに失敗しました: ${url}`));
    img.src = url;
  });
  const naturalW = img.naturalWidth || widthPx;
  const naturalH = img.naturalHeight || widthPx;
  const w = Math.max(1, Math.round(widthPx * pixelRatio));
  const h = Math.max(1, Math.round((widthPx * naturalH) / naturalW * pixelRatio));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context を取得できません");
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * 屋台の輪郭の中に商品写真をはめ込んだスプライト。
 * 本体（白い箱）の部分が写真になり、縁はカテゴリ色。屋根とひさしは通常の屋台のまま。
 * 店舗ごとに違うので、styleimagemissing で遅延生成する。
 */
export async function rasterizeStallWithPhoto(
  shop: Shop,
  state: StallState,
  url: string,
  sizePx: number,
  pixelRatio: number,
  fallbackUrl?: string
): Promise<ImageData> {
  const loadImage = async (src: string): Promise<HTMLImageElement> => {
    const el = new Image();
    el.decoding = "async";
    el.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`写真の読み込みに失敗しました: ${src}`));
      el.src = src;
    });
    return el;
  };

  let img: HTMLImageElement;
  try {
    img = await loadImage(url);
  } catch (err) {
    if (fallbackUrl && fallbackUrl !== url) {
      img = await loadImage(fallbackUrl);
    } else {
      throw err;
    }
  }

  // 写真は本体の矩形に cover でトリミングし、data URL にして SVG に埋め込む
  // （画像として描き起こす SVG は外部 URL を読めない）
  const rect = STALL_BODY_RECT;
  const crop = document.createElement("canvas");
  crop.width = rect.width * 4;
  crop.height = rect.height * 4;
  const cropCtx = crop.getContext("2d");
  if (!cropCtx) throw new Error("canvas 2d context を取得できません");
  const scale = Math.max(crop.width / img.naturalWidth, crop.height / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  cropCtx.drawImage(img, (crop.width - dw) / 2, (crop.height - dh) / 2, dw, dh);
  const href = crop.toDataURL("image/jpeg", 0.85);
  // sizePx は高さの基準。屋根を削った分だけ同じ高さに対して幅が広がり、写真が大きく写る
  const widthPx = sizePx / STALL_PHOTO_HEIGHT_RATIO;
  return rasterizeSvg(svgForState(recipeFor(shop), state, widthPx, href, sizePx), widthPx, pixelRatio, sizePx);
}

/**
 * お気に入り色を CSS 変数から読む（Leaflet 版と同じ色にするため）
 *
 * スプライトを描き起こすのは地図の初期化時で、そのときには
 * スタイルシートは読み終わっている。読めなかったときだけ控えの値を使う。
 */
function resolveFavoriteColor(): string {
  if (typeof window === "undefined") return SHOP_FAVORITE_COLOR_FALLBACK;
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue("--favorite-fg")
      .trim();
    return sanitizeCssColor(value) ?? SHOP_FAVORITE_COLOR_FALLBACK;
  } catch {
    return SHOP_FAVORITE_COLOR_FALLBACK;
  }
}

/**
 * お気に入りの印。Leaflet 版 .shop-favorite-badge と同じ見た目にする。
 *
 * クリーム地に木札と同じ茶色の枠、中身はお気に入り色のハート。
 * 文字（♥ や絵文字）ではなくパスで描くので、端末のフォントに左右されない。
 */
export function buildFavoriteBadgeSprite(pixelRatio: number): ImageData {
  const d = 20;
  const pad = 4;
  const size = d + pad * 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(size * pixelRatio);
  canvas.height = Math.round(size * pixelRatio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context を取得できません");
  ctx.scale(pixelRatio, pixelRatio);

  const c = pad + d / 2;
  const r = d / 2 - 0.5;

  // 地（クリーム）と影
  ctx.save();
  ctx.shadowColor = "rgba(76,53,22,0.2)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 枠（木札と同じ茶）
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(140,106,62,0.45)";
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.stroke();

  // ハート（お気に入り色）
  const heart = 11;
  const scale = heart / 24;
  ctx.save();
  ctx.translate(c - heart / 2, c - heart / 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = resolveFavoriteColor();
  ctx.fill(new Path2D(SHOP_FAVORITE_HEART_PATH));
  ctx.restore();

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * 木札の下地（Leaflet 版 .shop-nameplate と同じ配色）。
 * icon-text-fit で文字幅に合わせて伸ばすので、伸縮領域を指定した stretchable image にする。
 */
export function buildNameplateSprite(pixelRatio: number): {
  image: ImageData;
  stretchX: [number, number][];
  stretchY: [number, number][];
  content: [number, number, number, number];
} {
  const w = 44;
  const h = 26;
  const radius = 5;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * pixelRatio);
  canvas.height = Math.round(h * pixelRatio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context を取得できません");
  ctx.scale(pixelRatio, pixelRatio);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#f6e9d2");
  grad.addColorStop(1, "#e7d3ae");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, w - 1, h - 1, radius);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(140,106,62,0.45)";
  ctx.stroke();
  const px = (v: number) => Math.round(v * pixelRatio);
  return {
    image: ctx.getImageData(0, 0, canvas.width, canvas.height),
    stretchX: [[px(radius + 2), px(w - radius - 2)]],
    stretchY: [[px(radius + 2), px(h - radius - 2)]],
    content: [px(6), px(3), px(w - 6), px(h - 3)],
  };
}

export interface StallSprite {
  id: string;
  image: ImageData;
  pixelRatio: number;
}

/**
 * 店舗一覧から必要なスプライトをすべて作る。
 * 形×色の組ごとに 5 状態ぶん。カスタム SVG の店舗は個別に normal だけ描く。
 */
export async function buildStallSprites(shops: Shop[], pixelRatio = 2): Promise<StallSprite[]> {
  const px = ILLUSTRATION_SIZES.medium.width;
  const recipes = new Map<string, SpriteRecipe>();
  for (const shop of shops) {
    if (shop.illustration?.customSvg) continue;
    const key = stallSpriteKey(shop);
    if (!recipes.has(key)) recipes.set(key, recipeFor(shop));
  }
  const jobs: Promise<StallSprite | null>[] = [];
  for (const [key, recipe] of recipes) {
    for (const state of STALL_STATES) {
      jobs.push(
        memoImage(`stall:${key}:${state}@${pixelRatio}`, () =>
          rasterizeSvg(svgForState(recipe, state, px), px, pixelRatio)
        )
          .then((image) => ({ id: stallImageId(key, state), image, pixelRatio }))
          .catch((error: unknown) => {
            // 1 枚の失敗で全体を止めない（その店舗はアイコン無しになる）
            console.warn("[stallSprites]", key, state, error);
            return null;
          })
      );
    }
  }
  return (await Promise.all(jobs)).filter((s): s is StallSprite => s !== null);
}
