import { createClient } from "@/utils/supabase/client";
import { createStoreImages, imageUploadInfo } from "@/lib/image/clientCompression";
import type { Store, PaymentMethod, RainPolicy } from "../_types";

export type Category = { id: string; name: string };

export async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient();
  const { data } = await supabase.from("categories").select("id, name").order("name");
  return (data as Category[]) ?? [];
}

export async function fetchVendorStore(vendorId: string): Promise<Store | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("id, shop_name, category_id, style, style_tags, main_products, main_product_prices, payment_methods, rain_policy, schedule, shop_image_url, sns_instagram, sns_x, sns_hp, business_hours_start, business_hours_end")
    .eq("id", vendorId)
    .single();

  if (error || !data) return null;

  // 店主名は vendors から分離済み（公開可否は本人が管理する）
  const { data: ownerProfile } = await supabase
    .from("vendor_owner_profiles")
    .select("owner_name, is_public")
    .eq("vendor_id", vendorId)
    .maybeSingle();

  let mainProducts = (data.main_products as string[]) ?? [];

  // main_products が未設定の場合は products テーブルからフォールバック取得
  if (mainProducts.length === 0) {
    const { data: productsData } = await supabase
      .from("products")
      .select("name")
      .eq("vendor_id", vendorId);
    if (productsData && productsData.length > 0) {
      mainProducts = productsData.map((p: { name: string }) => p.name).filter(Boolean);
    }
  }

  return {
    id: data.id,
    vendor_id: data.id,
    name: data.shop_name ?? "",
    owner_name: ownerProfile?.owner_name ?? "",
    owner_name_public: ownerProfile?.is_public ?? false,
    category_id: (data.category_id as string) ?? "",
    style: (data.style as string) ?? "",
    style_tags: (data.style_tags as string[]) ?? [],
    main_products: mainProducts,
    main_product_prices: (data.main_product_prices as Record<string, number | null>) ?? {},
    payment_methods: ((data.payment_methods as string[]) ?? []) as PaymentMethod[],
    rain_policy: ((data.rain_policy as string) ?? "undecided") as RainPolicy,
    schedule: (data.schedule as string[]) ?? [],
    shop_image_url: (data.shop_image_url as string) ?? undefined,
    sns_instagram: (data.sns_instagram as string) ?? undefined,
    sns_x: (data.sns_x as string) ?? undefined,
    sns_hp: (data.sns_hp as string) ?? undefined,
    business_hours_start: (data.business_hours_start as string) ?? undefined,
    business_hours_end: (data.business_hours_end as string) ?? undefined,
  };
}

export async function uploadStoreImage(vendorId: string, file: File): Promise<string> {
  const supabase = createClient();

  // クライアント側でメイン用(1200px)とサムネ用(160px)のWebP画像に圧縮・リサイズ
  const { mainBlob, thumbBlob } = await createStoreImages(file);

  // WebP を書き出せないブラウザでは JPEG/PNG になるので、実際の形式で保存する
  const main = imageUploadInfo(mainBlob);
  const mainPath = `${vendorId}/store-main.${main.ext}`;
  // サムネイルの URL はメイン画像の URL から store-thumb.webp として組み立てる（lib/shopImages.ts の toStoreThumbUrl）。
  // 名前は固定したまま Content-Type だけ実際の形式に合わせる。ブラウザは Content-Type で画像を読むので表示できる
  const thumbPath = `${vendorId}/store-thumb.webp`;

  // メインとサムネイルを並行アップロード
  const [mainResult, thumbResult] = await Promise.all([
    supabase.storage
      .from("vendor-images")
      .upload(mainPath, mainBlob, { contentType: main.contentType, upsert: true }),
    supabase.storage
      .from("vendor-images")
      .upload(thumbPath, thumbBlob, {
        contentType: imageUploadInfo(thumbBlob).contentType,
        upsert: true,
      }),
  ]);

  if (mainResult.error) throw mainResult.error;
  if (thumbResult.error) {
    console.warn(
      "[uploadStoreImage] サムネイルのアップロードに失敗しました:",
      thumbResult.error.message
    );
  }

  // 今回保存したもの以外の store-main.*（旧形式の .jpg/.png や、形式が変わったときの前回分）を削除
  try {
    const { data: existingFiles } = await supabase.storage
      .from("vendor-images")
      .list(vendorId);

    const legacyFiles = (existingFiles ?? [])
      .filter((f) => f.name.startsWith("store-main."))
      .map((f) => `${vendorId}/${f.name}`)
      .filter((path) => path !== mainPath);

    if (legacyFiles.length > 0) {
      await supabase.storage.from("vendor-images").remove(legacyFiles);
    }
  } catch (cleanErr) {
    console.warn("[uploadStoreImage] 旧店舗画像のクリーンアップに失敗しました:", cleanErr);
  }

  const { data } = supabase.storage.from("vendor-images").getPublicUrl(mainPath);
  return data.publicUrl;
}

export async function saveVendorStore(
  vendorId: string,
  store: Omit<Store, "id" | "vendor_id">
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("vendors")
    .update({
      shop_name: store.name,
      category_id: store.category_id || null,
      style: store.style,
      style_tags: store.style_tags,
      main_products: store.main_products,
      main_product_prices: store.main_product_prices,
      payment_methods: store.payment_methods,
      rain_policy: store.rain_policy,
      schedule: store.schedule,
      shop_image_url: store.shop_image_url ?? null,
      sns_instagram: store.sns_instagram ?? null,
      sns_x: store.sns_x ?? null,
      sns_hp: store.sns_hp ?? null,
      business_hours_start: store.business_hours_start ?? null,
      business_hours_end: store.business_hours_end ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", vendorId);

  if (error) throw error;

  const { error: ownerProfileError } = await supabase
    .from("vendor_owner_profiles")
    .upsert(
      {
        vendor_id: vendorId,
        owner_name: store.owner_name ?? null,
        is_public: store.owner_name_public ?? false,
      },
      { onConflict: "vendor_id" }
    );

  if (ownerProfileError) throw ownerProfileError;
}
