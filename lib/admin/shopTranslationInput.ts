/**
 * 運営が現場登録で、店舗の英語版（訳）を保存・訳させるときの入力の検証。
 * 画面（FieldShopEditor）と API（/api/admin/shops/[id]/translation, /api/admin/shop-translations/preview）で共通。
 */
import type { ShopTranslation, TranslationSource } from "@/lib/i18n/shopTranslation";

/** AI の訳として受け入れる上限（原文300文字×4+80、商品名は60文字×4+80）に合わせる。下書きに出たものは必ず保存できる */
export const SHOP_TRANSLATION_FIELD_MAX = 1280;
export const SHOP_TRANSLATION_PRODUCT_MAX = 320;
const MAX_PRODUCTS = 100;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function optionalText(value: unknown, label: string): Result<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: `${label}の形が正しくありません` };
  const trimmed = value.trim();
  if (trimmed.length > SHOP_TRANSLATION_FIELD_MAX) return { ok: false, error: `${label}は${SHOP_TRANSLATION_FIELD_MAX}文字以内にしてください` };
  return { ok: true, value: trimmed || null };
}

/** 保存する英語版（店名の読み・ひとこと・出店スタイル・{ 日本語の商品名: 英語名 }） */
export function parseShopTranslationInput(body: unknown): Result<ShopTranslation> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "リクエストの形が正しくありません" };
  const record = body as Record<string, unknown>;
  const name = optionalText(record.name, "店名の読み");
  if (!name.ok) return name;
  const strength = optionalText(record.strength, "ひとこと");
  if (!strength.ok) return strength;
  const style = optionalText(record.style, "出店スタイル");
  if (!style.ok) return style;

  const products: Record<string, string> = {};
  if (record.products !== undefined && record.products !== null) {
    if (typeof record.products !== "object" || Array.isArray(record.products)) return { ok: false, error: "商品の英語名の形が正しくありません" };
    const entries = Object.entries(record.products as Record<string, unknown>);
    if (entries.length > MAX_PRODUCTS) return { ok: false, error: "商品が多すぎます" };
    for (const [ja, en] of entries) {
      if (typeof en !== "string") return { ok: false, error: "商品の英語名の形が正しくありません" };
      const trimmed = en.trim();
      if (trimmed.length > SHOP_TRANSLATION_PRODUCT_MAX) return { ok: false, error: `商品の英語名は${SHOP_TRANSLATION_PRODUCT_MAX}文字以内にしてください` };
      if (trimmed) products[ja] = trimmed;
    }
  }
  return { ok: true, value: { name: name.value, strength: strength.value, style: style.value, products } };
}

/** 訳させる日本語の原文（まだ保存していない画面の入力）。店主の氏名などは受け取らない */
export function parseTranslationSourceInput(body: unknown): Result<TranslationSource> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "リクエストの形が正しくありません" };
  const record = body as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const products = Array.isArray(record.products)
    ? [...new Set(record.products.filter((p): p is string => typeof p === "string").map((p) => p.trim()).filter(Boolean))].sort()
    : [];
  if (products.length > MAX_PRODUCTS) return { ok: false, error: "商品が多すぎます" };
  const source: TranslationSource = { name: text(record.name), strength: text(record.strength), style: text(record.style), products };
  if (!source.name && !source.strength && !source.style && products.length === 0) {
    return { ok: false, error: "訳す内容がありません。店名・ひとこと・商品などを入れてください" };
  }
  return { ok: true, value: source };
}
