/**
 * 屋台スプライトの描き起こし（MapLibre 用）
 *
 * シンボルレイヤーはビットマップしか受け付けないので、屋台パーツの SVG を
 * Canvas で一度だけ描き起こして map.addImage に登録する。
 * 画像の枚数は「形 × 色 × 状態」の組み合わせ数だが、色はカテゴリ数（十数種）、
 * 状態は normal / search / ai / bag / selected の 5 つなので、多くても数十枚に収まる。
 * 出店者のカスタム SVG は個別に描き起こす（色は変えられない）。
 */

import { ILLUSTRATION_SIZES } from "../../config/displayConfig";
import { resolveStallColors } from "../../config/shopCategories";
import {
  generateStallSpriteSvg,
  resolveStallParts,
  type StallPartsSpec,
} from "../../config/stallParts";
import { sanitizeCssColor } from "../../utils/markerHtmlGenerator";
import type { Shop } from "../../data/shops";

export type StallState = "normal" | "search" | "ai" | "bag" | "selected";
export const STALL_STATES: readonly StallState[] = ["normal", "search", "ai", "bag", "selected"];

/** 状態ごとの屋根・ひさし色（globals.css の状態上書きと同じ値） */
const STATE_COLORS: Record<Exclude<StallState, "normal" | "selected">, { roof: string; base: string; stripe: string }> = {
  search: { roof: "#2563eb", base: "#93c5fd", stripe: "#2563eb" },
  ai: { roof: "#ef4444", base: "#fca5a5", stripe: "#ef4444" },
  bag: { roof: "#f8fafc", base: "#34d399", stripe: "#10b981" },
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

function svgForState(recipe: SpriteRecipe, state: StallState, px: number): string {
  const stall = resolveStallColors(undefined, recipe.baseColor);
  if (state === "normal" || state === "selected") {
    return generateStallSpriteSvg(
      recipe.parts,
      {
        roof: stall.base,
        awningBase: stall.light,
        awningStripe: stall.base,
        outline: state === "selected" ? "#fbbf24" : undefined,
      },
      { width: px, height: px }
    );
  }
  const c = STATE_COLORS[state];
  return generateStallSpriteSvg(
    recipe.parts,
    { roof: c.roof, awningBase: c.base, awningStripe: c.stripe },
    { width: px, height: px }
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
export async function rasterizeImageUrl(
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
 * 屋根の上の丸窓（商品写真）。Leaflet 版 .shop-product-icon と同じ見立て:
 * 屋台色の枠、内側に写真、外側に落ちる影。styleimagemissing で店舗ごとに遅延生成する。
 */
export async function rasterizePhotoCircle(
  url: string,
  sizePx: number,
  borderColor: string,
  pixelRatio: number
): Promise<ImageData> {
  const img = new Image();
  img.decoding = "async";
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`写真の読み込みに失敗しました: ${url}`));
    img.src = url;
  });
  const pad = 4; // 影のぶん
  const size = Math.round((sizePx + pad * 2) * pixelRatio);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context を取得できません");
  ctx.scale(pixelRatio, pixelRatio);
  const c = sizePx / 2 + pad;
  const r = sizePx / 2;
  // 影
  ctx.save();
  ctx.shadowColor = "rgba(34,22,10,0.45)";
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#f1f5f9";
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // 写真（cover でトリミング）
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, r - 3, 0, Math.PI * 2);
  ctx.clip();
  const scale = Math.max((r * 2) / img.naturalWidth, (r * 2) / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, c - dw / 2, c - dh / 2, dw, dh);
  // ガラスの光沢
  const gloss = ctx.createLinearGradient(c - r, c - r, c + r, c + r);
  gloss.addColorStop(0, "rgba(255,255,255,0.26)");
  gloss.addColorStop(0.3, "rgba(255,255,255,0.07)");
  gloss.addColorStop(0.46, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.fillRect(c - r, c - r, r * 2, r * 2);
  ctx.restore();
  // 枠
  ctx.lineWidth = 3;
  ctx.strokeStyle = borderColor;
  ctx.beginPath();
  ctx.arc(c, c, r - 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(58,40,22,0.4)";
  ctx.beginPath();
  ctx.arc(c, c, r + 0.5, 0, Math.PI * 2);
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

/** お気に入り（♥ 橙）と買い物袋（🛍️ 緑）のバッジ。Leaflet 版 .shop-favorite-badge / .shop-bag-badge と同じ配色 */
export function buildBadgeSprite(kind: "favorite" | "bag", pixelRatio: number): ImageData {
  const w = 26;
  const h = 20;
  const pad = 4;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((w + pad * 2) * pixelRatio);
  canvas.height = Math.round((h + pad * 2) * pixelRatio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context を取得できません");
  ctx.scale(pixelRatio, pixelRatio);
  const color = kind === "favorite" ? "#f97316" : "#10b981";
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(pad, pad, w, h, h / 2);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.roundRect(pad + 1, pad + 1, w - 2, h - 2, (h - 2) / 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = kind === "favorite" ? "bold 12px sans-serif" : "11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(kind === "favorite" ? "♥" : "🛍", pad + w / 2, pad + h / 2 + 0.5);
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
        rasterizeSvg(svgForState(recipe, state, px), px, pixelRatio)
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
