import { createHash } from "node:crypto";
import { revalidateTag, unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAnonClient } from "@/lib/supabase/anonClient";
import { createAdminClient } from "@/lib/supabase/adminClient";
import type { DatabaseWithExtensions } from "@/types/database.extensions";
import type { Shop } from "@/app/(public)/map/types/shopData";
import { requestChatCompletion } from "@/lib/ai/openaiFetch";
import { resolveAiModelFor } from "@/lib/ai/modelStore.server";
import { parseFirstJsonObject } from "@/lib/ai/structuredOutput";
import { DEFAULT_LOCALE, type Locale } from "./config";
import {
  TRANSLATION_RESPONSE_FORMAT,
  TRANSLATION_SYSTEM_PROMPT,
  applyShopTranslation,
  buildTranslationSource,
  buildTranslationUserPrompt,
  hasTranslatableText,
  limitSourceForTranslation,
  parseTranslationOutput,
  serializeTranslationSource,
  type ShopTranslation,
  type TranslationBatchItem,
} from "./shopTranslation";

export const SHOP_TRANSLATIONS_CACHE_TAG = "shop-translations";
// 訳の追加は管理者の操作・定期実行で起きるので、少し遅れて反映されれば足りる
const SHOP_TRANSLATIONS_REVALIDATE_SECONDS = 15 * 60;
/**
 * 1回のAI呼び出しで訳す店の数。1店ずつにして、出店者の文面（指示のような文）が
 * 同じ呼び出しの別の店の訳に影響できないようにする。
 */
const BATCH_SIZE = 1;

type TranslationRow = DatabaseWithExtensions["public"]["Tables"]["shop_translations"]["Row"];

function toTranslation(row: Pick<TranslationRow, "name" | "strength" | "style" | "products">): ShopTranslation {
  return {
    name: row.name,
    strength: row.strength,
    style: row.style,
    products: row.products ?? {},
  };
}

/**
 * 保存済みの訳（vendor_id → 訳）。全員で共有するキャッシュなので、Cookie を持たない anon クライアントで読む
 * （RLS により、一般に見える店の訳だけが返る）。取れなければ空にして日本語のまま表示する。
 */
type StoredTranslation = { translation: ShopTranslation; sourceHash: string };

const getCachedTranslations = unstable_cache(
  async (locale: string): Promise<Record<string, StoredTranslation>> => {
    const anon = createAnonClient();
    if (!anon) return {};
    // 生成型に shop_translations が無いので、拡張型に合わせる（anonClient は型なし）
    const supabase = anon as unknown as SupabaseClient<DatabaseWithExtensions>;
    const { data, error } = await supabase
      .from("shop_translations")
      .select("vendor_id, name, strength, style, products, source_hash")
      .eq("locale", locale);
    if (error) {
      // 表が未作成（マイグレーション前）でも画面は止めない
      console.warn("[shop_translations] 取得に失敗しました:", error.message);
      return {};
    }
    return Object.fromEntries((data ?? []).map((row) => [row.vendor_id, { translation: toTranslation(row), sourceHash: row.source_hash }]));
  },
  ["shop-translations-v1"],
  { revalidate: SHOP_TRANSLATIONS_REVALIDATE_SECONDS, tags: [SHOP_TRANSLATIONS_CACHE_TAG] }
);

/** 店舗一覧に、そのロケールの訳を重ねる。日本語・訳が無い店はそのまま */
export async function applyShopTranslations(shops: Shop[], locale: Locale): Promise<Shop[]> {
  if (locale === DEFAULT_LOCALE || shops.length === 0) return shops;
  const translations = await getCachedTranslations(locale);
  return shops.map((shop) => {
    const stored = shop.vendorId ? translations[shop.vendorId] : undefined;
    if (!stored) return shop;
    // 日本語の原文が訳したときから変わっていたら、古い訳は出さず日本語のまま見せる（次の同期で訳し直す）
    const currentHash = hashTranslationSource(locale, buildTranslationSource(shop));
    return currentHash === stored.sourceHash ? applyShopTranslation(shop, stored.translation) : shop;
  });
}

export function revalidateShopTranslations() {
  revalidateTag(SHOP_TRANSLATIONS_CACHE_TAG, { expire: 0 });
}

export function hashTranslationSource(locale: Locale, source: ReturnType<typeof buildTranslationSource>): string {
  return createHash("sha256").update(serializeTranslationSource(locale, source)).digest("hex");
}

export type SyncShopTranslationsResult = {
  locale: Locale;
  /** 訳す必要があった店の数（原文が変わった・まだ無い） */
  pending: number;
  /** 今回訳して保存した店の数 */
  translated: number;
  /** 訳せなかった店の数（AIの失敗など。次の実行でやり直す） */
  failed: number;
};

/**
 * 公開されている店のうち、訳が無い・原文が変わった店を訳して保存する。
 *
 * - 対象は `shops`（一般に見える店）だけ。非公開の店はAIへ送らない
 * - status が reviewed の訳は、人が直したものなので上書きしない
 * - `limit` までで止める（1回の実行時間とAIの費用を抑える）。残りは次の実行で処理される
 */
export async function syncShopTranslations(params: {
  shops: Shop[];
  locale: Locale;
  limit: number;
}): Promise<SyncShopTranslationsResult> {
  const { shops, locale, limit } = params;
  const result: SyncShopTranslationsResult = { locale, pending: 0, translated: 0, failed: 0 };

  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase service role env vars are missing.");
  // 生成型に shop_translations が無いので、拡張型に合わせる（lib/supabase/adminClient.ts は型なし）
  const supabase = admin as unknown as SupabaseClient<DatabaseWithExtensions>;

  const { data: existing, error: existingError } = await supabase
    .from("shop_translations")
    .select("vendor_id, source_hash, status")
    .eq("locale", locale);
  if (existingError) throw new Error(`shop_translations の読み込みに失敗しました: ${existingError.message}`);
  const existingByVendor = new Map((existing ?? []).map((row) => [row.vendor_id, row]));

  const pending: { vendorId: string; hash: string; source: TranslationBatchItem["source"] }[] = [];
  for (const shop of shops) {
    if (!shop.vendorId) continue;
    const source = buildTranslationSource(shop);
    if (!hasTranslatableText(source)) continue;
    const hash = hashTranslationSource(locale, source);
    const current = existingByVendor.get(shop.vendorId);
    if (current?.status === "reviewed") continue;
    if (current?.source_hash === hash) continue;
    pending.push({ vendorId: shop.vendorId, hash, source });
  }
  result.pending = pending.length;

  const apiKey = process.env.OPENAI_API_KEY;
  const targets = pending.slice(0, Math.max(0, limit));
  if (targets.length === 0) return result;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing.");

  const aiModel = await resolveAiModelFor("translation");

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    // 出店者の文面に他店の識別子（UUID）を混ぜられないよう、プロンプトには連番だけを渡す
    const items: TranslationBatchItem[] = batch.map((target, index) => ({ key: String(index + 1), source: limitSourceForTranslation(target.source) }));
    try {
      const response = await requestChatCompletion(apiKey, aiModel, {
        messages: [
          { role: "system", content: TRANSLATION_SYSTEM_PROMPT },
          { role: "user", content: buildTranslationUserPrompt(locale, items) },
        ],
        maxOutputTokens: 3000,
        temperature: 0.2,
        responseFormat: TRANSLATION_RESPONSE_FORMAT,
      });
      if (!response.ok) throw new Error(`chat completion failed (${response.status})`);
      const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const content = payload.choices?.[0]?.message?.content ?? "";
      const parsed = parseTranslationOutput(parseFirstJsonObject(content), items);

      const rows = batch.flatMap((target) => {
        const translation = parsed.get(String(batch.indexOf(target) + 1));
        if (!translation) return [];
        return [
          {
            vendor_id: target.vendorId,
            locale,
            name: translation.name,
            strength: translation.strength,
            style: translation.style,
            // 旧バージョンのAI訳は使わない。雨天対応は保存キーから固定訳を表示する。
            rain_policy: null,
            products: translation.products,
            source_hash: target.hash,
            status: "auto" as const,
            model: aiModel.def.id,
            updated_at: new Date().toISOString(),
          },
        ];
      });
      if (rows.length > 0) {
        const { error } = await supabase.from("shop_translations").upsert(rows, { onConflict: "vendor_id,locale" });
        if (error) throw new Error(error.message);
      }
      result.translated += rows.length;
      result.failed += batch.length - rows.length;
    } catch (error) {
      console.error("[syncShopTranslations] 訳せませんでした:", error);
      result.failed += batch.length;
    }
  }

  if (result.translated > 0) revalidateShopTranslations();
  return result;
}

