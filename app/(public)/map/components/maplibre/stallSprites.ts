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

/** SVG 文字列をビットマップに描き起こす（pixelRatio 倍で描いて高解像度画面でも鮮明にする） */
export async function rasterizeSvg(svg: string, px: number, pixelRatio: number): Promise<ImageData> {
  // data URL で読む（blob: だと環境によって SVG の読み込みに失敗することがある）
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const img = new Image();
  img.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("stall sprite の描き起こしに失敗しました"));
    img.src = url;
  });
  const size = Math.round(px * pixelRatio);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context を取得できません");
  ctx.drawImage(img, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
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
