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
  buildVendorTranslationSource,
  hasTranslatableText,
  limitSourceForTranslation,
  parseTranslationOutput,
  serializeTranslationSource,
  type ShopTranslation,
  type TranslationBatchItem,
  type TranslationSource,
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

/**
 * AI に原文を訳させて、key ごとの訳を返す（同期と、運営の現場登録の「訳を見る」で共通）。
 * 失敗したら例外を投げる。返事に無い key は結果に入らない。
 */
async function requestTranslations(
  apiKey: string,
  aiModel: Awaited<ReturnType<typeof resolveAiModelFor>>,
  locale: Locale,
  items: TranslationBatchItem[]
): Promise<Map<string, ShopTranslation>> {
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
  return parseTranslationOutput(parseFirstJsonObject(content), items);
}

/**
 * 運営の現場登録: まだ保存していない日本語の原文を、その場で訳して見せる（保存はしない）。
 * 運営が確認・手直ししてから、saveReviewedShopTranslation で保存する。
 */
export async function previewShopTranslation(source: TranslationSource, locale: Locale): Promise<{ translation: ShopTranslation; model: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing.");
  const aiModel = await resolveAiModelFor("translation");
  const limited = limitSourceForTranslation(source);
  const parsed = await requestTranslations(apiKey, aiModel, locale, [{ key: "1", source: limited }]);
  const translation = parsed.get("1");
  return translation ? { translation, model: aiModel.def.id } : null;
}

/**
 * 自動訳を1行書く。すでに reviewed の行は書かない（同期の途中で運営が確認した訳を守る）。
 * 既存行は「reviewed でない場合だけ」更新し、行が無ければ作る（同時に作られていたら何もしない）。書いたら true
 */
async function writeAutoTranslation(
  supabase: SupabaseClient<DatabaseWithExtensions>,
  row: { vendor_id: string; locale: Locale } & Record<string, unknown>
): Promise<boolean> {
  const { vendor_id, locale, ...rest } = row;
  const { data: updated, error: updateError } = await supabase
    .from("shop_translations")
    .update(rest as never)
    .eq("vendor_id", vendor_id)
    .eq("locale", locale)
    .neq("status", "reviewed")
    .select("vendor_id");
  if (updateError) throw new Error(updateError.message);
  if (updated && updated.length > 0) return true;
  const { data: inserted, error: insertError } = await supabase
    .from("shop_translations")
    .upsert(row as never, { onConflict: "vendor_id,locale", ignoreDuplicates: true })
    .select("vendor_id");
  if (insertError) throw new Error(insertError.message);
  return !!inserted && inserted.length > 0;
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
    try {
      // 出店者の文面に他店の識別子（UUID）を混ぜられないよう、プロンプトには連番だけを渡す
      const items: TranslationBatchItem[] = batch.map((target, index) => ({ key: String(index + 1), source: limitSourceForTranslation(target.source) }));
      const parsed = await requestTranslations(apiKey, aiModel, locale, items);

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
      // AIを待つ間に運営が確認した訳（reviewed）に変わった行は、上書きしない
      let written = 0;
      for (const row of rows) {
        if (await writeAutoTranslation(supabase, row)) written += 1;
      }
      result.translated += written;
      result.failed += batch.length - rows.length;
    } catch (error) {
      console.error("[syncShopTranslations] 訳せませんでした:", error);
      result.failed += batch.length;
    }
  }

  if (result.translated > 0) revalidateShopTranslations();
  return result;
}


type AdminSupabase = SupabaseClient<DatabaseWithExtensions>;

function getAdminSupabase(): AdminSupabase {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase service role env vars are missing.");
  // 生成型に shop_translations が無いので、拡張型に合わせる（lib/supabase/adminClient.ts は型なし）
  return admin as unknown as AdminSupabase;
}

/** 店舗 1 件の、いま保存されている日本語から訳す原文を作る（公開の可否に関わらず読む）。店が無ければ null */
async function loadVendorSource(supabase: AdminSupabase, vendorId: string): Promise<{ source: TranslationSource; updatedAt: string | null } | null> {
  const [{ data: vendor, error }, { data: productRows, error: productsError }] = await Promise.all([
    supabase
      .from("vendors")
      .select("shop_name, strength, style, main_products, main_product_prices, updated_at")
      .eq("id", vendorId)
      .maybeSingle(),
    supabase.from("products").select("name, image_url").eq("vendor_id", vendorId),
  ]);
  if (error) throw new Error(`vendors の読み込みに失敗しました: ${error.message}`);
  if (productsError) throw new Error(`products の読み込みに失敗しました: ${productsError.message}`);
  if (!vendor) return null;
  const source = buildVendorTranslationSource(
    {
      shop_name: vendor.shop_name,
      strength: vendor.strength,
      style: vendor.style,
      main_products: vendor.main_products,
      main_product_prices: vendor.main_product_prices as Record<string, number | null> | null,
    },
    (productRows ?? []) as { name: string | null; image_url: string | null }[]
  );
  return { source, updatedAt: (vendor as { updated_at?: string | null }).updated_at ?? null };
}

export type StoredVendorTranslation = {
  translation: ShopTranslation;
  status: "auto" | "reviewed";
  /** 訳したあとに日本語が変わった（来訪者には、この訳は出ない） */
  stale: boolean;
};

/** 運営の現場登録: その店の保存済みの訳。無ければ null。表の無い DB（マイグレーション前）でも null */
export async function getVendorTranslation(vendorId: string, locale: Locale): Promise<StoredVendorTranslation | null> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("shop_translations")
    .select("name, strength, style, products, source_hash, status")
    .eq("vendor_id", vendorId)
    .eq("locale", locale)
    .maybeSingle();
  if (error || !data) return null;
  const loaded = await loadVendorSource(supabase, vendorId);
  const source = loaded?.source;
  const stale = !source || hashTranslationSource(locale, source) !== data.source_hash;
  return { translation: toTranslation(data), status: data.status, stale };
}

export type SaveReviewedResult = "saved" | "deleted" | "not_found";

/**
 * 運営が確認・手直しした訳を保存する（status = reviewed。以後、自動の同期で上書きしない）。
 * 原文のハッシュは、いま保存されている日本語から作る。保存の前に日本語を保存しておくこと。
 * 項目がすべて空なら訳を消す（その店は、また自動の同期の対象に戻る）。
 * 商品は、いまの商品名に無いものは捨てる。
 */
export async function saveReviewedShopTranslation(params: {
  vendorId: string;
  locale: Locale;
  translation: ShopTranslation;
  /** 日本語を直したあと、英語版を確認していない。どの日本語にも合わない印で保存し、来訪者には日本語を出す */
  stale?: boolean;
  /** 日本語を保存したときの updated_at。いまの店舗と違えば、ほかの人が日本語を変えている */
  expectedUpdatedAt?: string | null;
}): Promise<SaveReviewedResult> {
  const { vendorId, locale } = params;
  const supabase = getAdminSupabase();
  const loaded = await loadVendorSource(supabase, vendorId);
  if (!loaded) return "not_found";
  const { source } = loaded;
  // 画面が日本語を保存した時点から、ほかの人が日本語を変えていたら、この英語は今の日本語に合うと言えない
  const changedSince =
    params.expectedUpdatedAt != null && (!loaded.updatedAt || new Date(loaded.updatedAt).getTime() !== new Date(params.expectedUpdatedAt).getTime());

  const clean = (value: string | null) => (value?.trim() ? value.trim() : null);
  const known = new Set(source.products);
  const products = Object.fromEntries(
    Object.entries(params.translation.products)
      .map(([ja, en]) => [ja, en.trim()] as const)
      .filter(([ja, en]) => known.has(ja) && en !== "")
  );
  const translation: ShopTranslation = {
    name: clean(params.translation.name),
    strength: clean(params.translation.strength),
    style: clean(params.translation.style),
    products,
  };

  if (!translation.name && !translation.strength && !translation.style && Object.keys(products).length === 0) {
    const { error } = await supabase.from("shop_translations").delete().eq("vendor_id", vendorId).eq("locale", locale);
    if (error) throw new Error(error.message);
    revalidateShopTranslations();
    return "deleted";
  }

  const { error } = await supabase.from("shop_translations").upsert(
    {
      vendor_id: vendorId,
      locale,
      name: translation.name,
      strength: translation.strength,
      style: translation.style,
      rain_policy: null,
      products,
      source_hash: params.stale || changedSince ? `stale:${hashTranslationSource(locale, source)}` : hashTranslationSource(locale, source),
      status: "reviewed" as const,
      model: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "vendor_id,locale" }
  );
  if (error) throw new Error(error.message);
  revalidateShopTranslations();
  return "saved";
}
