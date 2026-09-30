import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { imageUploadInfo, resizeImageToBlob, STORE_IMAGE_CONFIG } from "@/lib/image/clientCompression";
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

const orNull = (value: string) => value.trim() || null;

export async function fetchAskSnapshot(
  vendorId: string,
  weekDate: string
): Promise<VendorAskSnapshot> {
  const supabase = untypedClient();

  const [vendorResult, productResult, weeklyResult] = await Promise.all([
    supabase
      .from("vendors")
      .select(
        "business_hours_start, business_hours_end, payment_methods, payment_note, sns_instagram, sns_hp, rain_policy, rain_note, strength, motivation, years_running, sunday_love"
      )
      .eq("id", vendorId)
      .single(),
    // 看板商品は、登録順の先頭の商品として扱う
    supabase
      .from("products")
      .select("id, name, image_url, description")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("vendor_weekly_status")
      .select("is_open, products")
      .eq("vendor_id", vendorId)
      .eq("week_date", weekDate)
      .maybeSingle(),
  ]);

  if (vendorResult.error || !vendorResult.data) {
    throw new Error("店舗情報を取得できませんでした。");
  }
  const vendor = vendorResult.data;
  const product = productResult.data;
  const weekly = weeklyResult.data;

  return {
    businessHoursStart: vendor.business_hours_start ?? undefined,
    businessHoursEnd: vendor.business_hours_end ?? undefined,
    signatureProduct: product
      ? {
          name: product.name,
          imageUrl: product.image_url ?? undefined,
          description: product.description ?? undefined,
        }
      : undefined,
    paymentMethods: ((vendor.payment_methods as string[] | null) ?? []) as PaymentMethod[],
    paymentNote: vendor.payment_note ?? undefined,
    instagram: vendor.sns_instagram ?? undefined,
    website: vendor.sns_hp ?? undefined,
    rainPolicy: ((vendor.rain_policy as string | null) ?? "undecided") as RainPolicy,
    rainNote: vendor.rain_note ?? undefined,
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
  if (!data || data.length === 0) throw new Error("店舗情報が見つかりませんでした。");
}

/** 看板商品（登録順の先頭）の id。無ければ null */
async function findSignatureProductId(
  supabase: SupabaseClient,
  vendorId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: true })
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
  let productId = await findSignatureProductId(supabase, vendorId);

  if (productId) {
    const { error } = await supabase
      .from("products")
      .update({ name: trimmed, updated_at: new Date().toISOString() })
      .eq("id", productId);
    if (error) throw error;
  } else {
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
      .eq("id", productId);
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
  if (!mainProducts.includes(trimmed)) {
    await updateVendor(supabase, vendorId, { main_products: [...mainProducts, trimmed] });
  }
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
      if (!productId) throw new Error("先に看板商品を登録してください。");
      const { error } = await supabase
        .from("products")
        .update({ description: orNull(answer.text), updated_at: new Date().toISOString() })
        .eq("id", productId);
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
    case "rain":
      return updateVendor(supabase, vendorId, {
        rain_policy: answer.policy,
        rain_note: orNull(answer.note),
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
