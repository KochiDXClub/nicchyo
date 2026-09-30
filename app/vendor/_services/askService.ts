import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { imageUploadInfo, resizeImageToBlob, STORE_IMAGE_CONFIG } from "@/lib/image/clientCompression";
import { uploadStoreImage } from "./storeService";
import type { AskAnswer, VendorAskSnapshot } from "@/lib/vendor/askQuestions";
import type { PaymentMethod, RainPolicy } from "../_types";

// 出店者ページの「にちよさんの質問」の読み書き。質問の中身と選び方は
// lib/vendor/askQuestions.ts にあり、ここは保存先（Supabase）とのやり取りだけを持つ。
//
// NOTE: payment_note / rain_note / motivation / years_running / sunday_love 列と
// vendor_weekly_status テーブルはマイグレーション
// (20260930140059_add_vendor_ask_answers.sql) で追加する。
// 生成済みの Database 型に反映されるまでは、ジェネリック無しの SupabaseClient に
// キャストして参照する（型再生成後はキャストを外せる。closedDatesService と同じ扱い）。
function untypedClient(): SupabaseClient {
  return createClient() as unknown as SupabaseClient;
}

/**
 * 出店者がそのまま読んで対処できる失敗（例:「先に看板商品を登録してください」）。
 * 画面は、これ以外の失敗（通信・権限など）を「うまく保存できんかった」にまとめるが、
 * これだけはメッセージをそのまま出す。
 */
export class AskUserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AskUserFacingError";
  }
}

const orNull = (value: string) => value.trim() || null;

export async function fetchAskSnapshot(
  vendorId: string,
  weekDate: string
): Promise<VendorAskSnapshot> {
  const supabase = untypedClient();

  const [vendorResult, productResult, weeklyResult, ownerResult, categoryResult] = await Promise.all([
    supabase
      .from("vendors")
      .select(
        "shop_name, shop_image_url, category_id, style, style_tags, main_products, main_product_prices, schedule, sns_x, business_hours_start, business_hours_end, payment_methods, payment_note, sns_instagram, sns_hp, rain_policy, rain_note, rain_answered_at, signature_product_name, strength, motivation, years_running, sunday_love"
      )
      .eq("id", vendorId)
      .single(),
    supabase
      .from("products")
      .select("id, name, image_url, description")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: true }),
    supabase
      .from("vendor_weekly_status")
      .select("is_open, products")
      .eq("vendor_id", vendorId)
      .eq("week_date", weekDate)
      .maybeSingle(),
    // 店主名は vendors から分離済み（公開するかどうかは本人が決める）
    supabase
      .from("vendor_owner_profiles")
      .select("owner_name, is_public")
      .eq("vendor_id", vendorId)
      .maybeSingle(),
    supabase.from("categories").select("id, name").order("name"),
  ]);

  if (vendorResult.error || !vendorResult.data) {
    throw new AskUserFacingError("店舗情報を取得できませんでした。");
  }
  const vendor = vendorResult.data;
  const products = (productResult.data ?? []) as {
    name: string;
    image_url: string | null;
    description: string | null;
  }[];
  const weekly = weeklyResult.data;
  const owner = ownerResult.data as { owner_name: string | null; is_public: boolean | null } | null;
  const categories = (categoryResult.data ?? []) as { id: string; name: string }[];
  const categoryId = (vendor.category_id as string | null) ?? undefined;
  const mainProducts = (vendor.main_products as string[] | null) ?? [];
  const prices = (vendor.main_product_prices as Record<string, number | null> | null) ?? {};
  // 看板商品は vendors.signature_product_name と同じ名前の商品。
  // 「登録順の先頭」で決めると、別の商品名を答えたときに先頭の商品を書き換えてしまう
  const signatureName = (vendor.signature_product_name as string | null)?.trim();
  const product = signatureName ? products.find((item) => item.name === signatureName) : undefined;

  return {
    shopName: vendor.shop_name ?? undefined,
    shopImageUrl: vendor.shop_image_url ?? undefined,
    categoryId,
    categoryName: categories.find((category) => category.id === categoryId)?.name,
    categoryOptions: categories,
    style: vendor.style ?? undefined,
    styleTags: (vendor.style_tags as string[] | null) ?? [],
    ownerName: owner?.owner_name ?? undefined,
    ownerNamePublic: owner?.is_public ?? false,
    products: mainProducts.map((name) => ({ name, price: prices[name] ?? null })),
    schedule: (vendor.schedule as string[] | null) ?? [],
    snsX: vendor.sns_x ?? undefined,
    businessHoursStart: vendor.business_hours_start ?? undefined,
    businessHoursEnd: vendor.business_hours_end ?? undefined,
    signatureProduct: product
      ? {
          name: product.name,
          imageUrl: product.image_url ?? undefined,
          description: product.description ?? undefined,
        }
      : undefined,
    // まだ看板商品を決めていない人には、登録済みの先頭の商品名を入力欄の初期値として出す
    signatureNameHint: products[0]?.name,
    paymentMethods: ((vendor.payment_methods as string[] | null) ?? []) as PaymentMethod[],
    paymentNote: vendor.payment_note ?? undefined,
    instagram: vendor.sns_instagram ?? undefined,
    website: vendor.sns_hp ?? undefined,
    rainPolicy: ((vendor.rain_policy as string | null) ?? "undecided") as RainPolicy,
    rainNote: vendor.rain_note ?? undefined,
    // 既定値の「当日判断」のままなのか、本人が選んだのかを見分けるため、答えた日時も見る
    rainAnswered:
      !!vendor.rain_answered_at ||
      ((vendor.rain_policy as string | null) ?? "undecided") !== "undecided" ||
      !!(vendor.rain_note as string | null)?.trim(),
    strength: vendor.strength ?? undefined,
    motivation: vendor.motivation ?? undefined,
    yearsRunning: vendor.years_running ?? null,
    sundayLove: vendor.sunday_love ?? undefined,
    weekly: weekly
      ? {
          isOpen: weekly.is_open ?? null,
          products: (weekly.products as string[] | null) ?? [],
        }
      : null,
  };
}

async function updateVendor(
  supabase: SupabaseClient,
  vendorId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { data, error } = await supabase
    .from("vendors")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", vendorId)
    .select("id");

  if (error) throw error;
  // RLS で弾かれた・行が無いときはエラーにならず 0 件になるので、成功と取り違えない
  if (!data || data.length === 0) throw new AskUserFacingError("店舗情報が見つかりませんでした。");
}

/** 看板商品（vendors.signature_product_name と同じ名前の商品）の id。無ければ null */
async function findSignatureProductId(
  supabase: SupabaseClient,
  vendorId: string
): Promise<string | null> {
  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select("signature_product_name")
    .eq("id", vendorId)
    .single();
  if (vendorError) throw vendorError;
  const name = (vendor?.signature_product_name as string | null)?.trim();
  if (!name) return null;

  const { data, error } = await supabase
    .from("products")
    .select("id")
    .eq("vendor_id", vendorId)
    .eq("name", name)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}

async function uploadProductImage(
  supabase: SupabaseClient,
  vendorId: string,
  productId: string,
  file: File
): Promise<string> {
  const blob = await resizeImageToBlob(file, STORE_IMAGE_CONFIG.main);
  const { contentType, ext } = imageUploadInfo(blob);
  const path = `${vendorId}/product-${productId}.${ext}`;

  const { error } = await supabase.storage
    .from("vendor-images")
    .upload(path, blob, { contentType, upsert: true });
  if (error) throw error;

  // 形式が変わったとき（jpg → webp など）に前の写真が残らないよう、同じ商品の古いファイルを消す。
  // 消せなくても保存自体は成功させたいので、失敗は握りつぶす
  try {
    const { data: files } = await supabase.storage.from("vendor-images").list(vendorId);
    const stale = (files ?? [])
      .filter((file) => file.name.startsWith(`product-${productId}.`))
      .map((file) => `${vendorId}/${file.name}`)
      .filter((existing) => existing !== path);
    if (stale.length > 0) await supabase.storage.from("vendor-images").remove(stale);
  } catch {
    // 容量が少し残るだけ
  }

  // 同じ名前で上書きしても、ブラウザが古い写真を出し続けないよう版を付ける
  const { data } = supabase.storage.from("vendor-images").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

async function saveSignature(
  supabase: SupabaseClient,
  vendorId: string,
  name: string,
  imageFile: File | null
): Promise<void> {
  const trimmed = name.trim();

  // 同じ名前の商品があればそれを看板商品にし、無ければ新しい商品として登録する。
  // 既存の商品を別の名前に書き換えると、その商品が商品一覧から消えてしまう
  const { data: existing, error: findError } = await supabase
    .from("products")
    .select("id")
    .eq("vendor_id", vendorId)
    .eq("name", trimmed)
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;

  let productId = existing?.id as string | undefined;
  if (!productId) {
    const { data, error } = await supabase
      .from("products")
      .insert({ vendor_id: vendorId, name: trimmed })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("商品を登録できませんでした。");
    productId = data.id as string;
  }

  if (imageFile) {
    const imageUrl = await uploadProductImage(supabase, vendorId, productId, imageFile);
    const { error } = await supabase
      .from("products")
      .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("vendor_id", vendorId);
    if (error) throw error;
  }

  // 店舗情報の編集画面・AI案内は main_products（商品名の一覧）を読むので、そちらにも入れておく
  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select("main_products")
    .eq("id", vendorId)
    .single();
  if (vendorError) throw vendorError;
  const mainProducts = (vendor?.main_products as string[] | null) ?? [];

  await updateVendor(supabase, vendorId, {
    signature_product_name: trimmed,
    ...(mainProducts.includes(trimmed) ? {} : { main_products: [...mainProducts, trimmed] }),
  });
}

/** 1つの質問の回答を保存する。weekDate は「今週」の日曜（YYYY-MM-DD） */
export async function saveAskAnswer(
  vendorId: string,
  weekDate: string,
  answer: AskAnswer
): Promise<void> {
  const supabase = untypedClient();

  switch (answer.id) {
    case "weekly-products": {
      const { error } = await supabase.from("vendor_weekly_status").upsert(
        {
          vendor_id: vendorId,
          week_date: weekDate,
          products: answer.products,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "vendor_id,week_date" }
      );
      if (error) throw error;
      return;
    }
    case "hours":
      return updateVendor(supabase, vendorId, {
        business_hours_start: answer.start,
        business_hours_end: answer.end,
      });
    case "signature":
      return saveSignature(supabase, vendorId, answer.name, answer.imageFile);
    case "signature-pr": {
      const productId = await findSignatureProductId(supabase, vendorId);
      if (!productId) throw new AskUserFacingError("先に看板商品を登録してください。");
      const { error } = await supabase
        .from("products")
        .update({ description: orNull(answer.text), updated_at: new Date().toISOString() })
        .eq("id", productId)
      .eq("vendor_id", vendorId);
      if (error) throw error;
      return;
    }
    case "payment":
      return updateVendor(supabase, vendorId, {
        payment_methods: answer.methods,
        payment_note: orNull(answer.note),
      });
    case "instagram":
      return updateVendor(supabase, vendorId, { sns_instagram: orNull(answer.value) });
    case "website":
      return updateVendor(supabase, vendorId, { sns_hp: orNull(answer.value) });
    case "x":
      return updateVendor(supabase, vendorId, { sns_x: orNull(answer.value) });
    case "shop-photo": {
      const imageUrl = await uploadStoreImage(vendorId, answer.imageFile);
      return updateVendor(supabase, vendorId, { shop_image_url: imageUrl });
    }
    case "shop-name":
      return updateVendor(supabase, vendorId, { shop_name: answer.text.trim() });
    case "category":
      return updateVendor(supabase, vendorId, { category_id: answer.categoryId || null });
    case "style":
      return updateVendor(supabase, vendorId, {
        style_tags: answer.tags,
        style: answer.note.trim(),
      });
    case "owner": {
      // 店主名は専用テーブルへ。公開するかどうかも本人の設定として保存する
      const { error } = await supabase.from("vendor_owner_profiles").upsert(
        {
          vendor_id: vendorId,
          owner_name: orNull(answer.name),
          is_public: answer.isPublic,
        },
        { onConflict: "vendor_id" }
      );
      if (error) throw error;
      return;
    }
    case "products": {
      const prices: Record<string, number | null> = {};
      for (const item of answer.items) prices[item.name] = item.price;
      return updateVendor(supabase, vendorId, {
        main_products: answer.items.map((item) => item.name),
        main_product_prices: prices,
      });
    }
    case "schedule":
      return updateVendor(supabase, vendorId, { schedule: answer.items });
    case "rain":
      return updateVendor(supabase, vendorId, {
        rain_policy: answer.policy,
        rain_note: orNull(answer.note),
        rain_answered_at: new Date().toISOString(),
      });
    case "strength":
      return updateVendor(supabase, vendorId, { strength: orNull(answer.text) });
    case "motivation":
      return updateVendor(supabase, vendorId, { motivation: orNull(answer.text) });
    case "years":
      return updateVendor(supabase, vendorId, { years_running: answer.years });
    case "sunday-love":
      return updateVendor(supabase, vendorId, { sunday_love: orNull(answer.text) });
  }
}
