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

  // どれか1つでも読めなかったら、画面ごと「読めんかった」にする。
  // 空として出すと、読めなかった答え（公開の設定や今週の商品）をそのまま上書きさせてしまう
  if (
    vendorResult.error ||
    !vendorResult.data ||
    productResult.error ||
    weeklyResult.error ||
    ownerResult.error ||
    categoryResult.error
  ) {
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
    // 「商品」ページだけで登録した人にも、商品名を補って見せる
    products: (mainProducts.length > 0 ? mainProducts : products.map((item) => item.name)).map((name) => ({
      name,
      price: prices[name] ?? null,
      imageUrl: products.find((item) => item.name === name)?.image_url ?? undefined,
    })),
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

/** 店舗写真（store-main.* と store-thumb.webp）を Storage から消す。失敗しても投げない */
async function removeStoreImages(supabase: SupabaseClient, vendorId: string): Promise<void> {
  try {
    const { data } = await supabase.storage.from("vendor-images").list(vendorId);
    const paths = (data ?? [])
      .map((file) => file.name)
      .filter((name) => name.startsWith("store-main.") || name === "store-thumb.webp")
      .map((name) => `${vendorId}/${name}`);
    if (paths.length > 0) await supabase.storage.from("vendor-images").remove(paths);
  } catch {
    // 消せなかった写真は残るが、店舗情報からは外れているので表には出ない
  }
}

/** 今の看板商品（vendors.signature_product_name と同じ名前の商品） */
async function findSignatureProduct(
  supabase: SupabaseClient,
  vendorId: string
): Promise<{ id: string; imageUrl: string | null } | null> {
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
    .select("id, image_url")
    .eq("vendor_id", vendorId)
    .eq("name", name)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id as string, imageUrl: (data.image_url as string | null) ?? null };
}

/** 看板商品（vendors.signature_product_name と同じ名前の商品）の id。無ければ null */
async function findSignatureProductId(supabase: SupabaseClient, vendorId: string): Promise<string | null> {
  return (await findSignatureProduct(supabase, vendorId))?.id ?? null;
}

/**
 * 商品の写真ファイル（product-<商品id>.*）を Storage から消す。keepPath は残すファイル。
 * 消せなくても保存自体は成功させたいので、失敗は握りつぶす（容量が少し残るだけ）
 */
async function removeProductImageFiles(
  supabase: SupabaseClient,
  vendorId: string,
  productId: string,
  keepPath?: string
): Promise<void> {
  try {
    const { data: files } = await supabase.storage.from("vendor-images").list(vendorId);
    const stale = (files ?? [])
      .filter((file) => file.name.startsWith(`product-${productId}.`))
      .map((file) => `${vendorId}/${file.name}`)
      .filter((existing) => existing !== keepPath);
    if (stale.length > 0) await supabase.storage.from("vendor-images").remove(stale);
  } catch {
    // 消せなかった写真は残るが、商品の行から外れているので表には出ない
  }
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

  // 形式が変わったとき（jpg → webp など）に前の写真が残らないよう、同じ商品の古いファイルを消す
  await removeProductImageFiles(supabase, vendorId, productId, path);

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
    .select("id, image_url")
    .eq("vendor_id", vendorId)
    .eq("name", trimmed)
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;

  // 名前だけ直したとき（写真を選び直していない）は、前の看板商品の写真を引き継ぐ。
  // 入力欄には前の写真が出たままなので、出店者は写真もそのままのつもりでいる
  const carriedImageUrl = imageFile ? null : ((await findSignatureProduct(supabase, vendorId))?.imageUrl ?? null);

  let productId = existing?.id as string | undefined;
  if (!productId) {
    const { data, error } = await supabase
      .from("products")
      .insert({ vendor_id: vendorId, name: trimmed, image_url: carriedImageUrl })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("商品を登録できませんでした。");
    productId = data.id as string;
  } else if (carriedImageUrl && !existing?.image_url) {
    const { error } = await supabase
      .from("products")
      .update({ image_url: carriedImageUrl, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("vendor_id", vendorId);
    if (error) throw error;
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

type ProductItem = Extract<AskAnswer, { id: "products" }>["items"][number];

/**
 * 主な商品（名前・値段・写真）を保存する。名前と値段は vendors に、写真は products テーブルの
 * 同じ名前の商品に置く（看板商品と同じ決まり）。写真は WebP に変換して vendor-images に保存する。
 * 一覧から外した商品は、写真を外し、説明や旬を持たない行は products からも消す（そのままだと、全部外したあとに商品名だけ復活する）
 */
async function saveProducts(supabase: SupabaseClient, vendorId: string, items: ProductItem[]): Promise<void> {
  const [vendorResult, rowsResult] = await Promise.all([
    supabase.from("vendors").select("main_products, signature_product_name").eq("id", vendorId).single(),
    supabase.from("products").select("id, name, image_url, description").eq("vendor_id", vendorId),
  ]);
  if (vendorResult.error) throw vendorResult.error;
  if (rowsResult.error) throw rowsResult.error;
  const rows = (rowsResult.data ?? []) as { id: string; name: string; image_url: string | null; description: string | null }[];
  const mainProducts = (vendorResult.data?.main_products as string[] | null) ?? [];
  const signatureName = (vendorResult.data?.signature_product_name as string | null)?.trim();

  for (const item of items) {
    if (item.imageFile === undefined) continue;
    const existing = rows.find((row) => row.name === item.name);

    if (item.imageFile === null) {
      if (!existing?.image_url) continue;
      const { error } = await supabase
        .from("products")
        .update({ image_url: null, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .eq("vendor_id", vendorId);
      if (error) throw error;
      await removeProductImageFiles(supabase, vendorId, existing.id);
      continue;
    }

    let productId = existing?.id;
    if (!productId) {
      const { data, error } = await supabase
        .from("products")
        .insert({ vendor_id: vendorId, name: item.name })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("商品を登録できませんでした。");
      productId = data.id as string;
    }
    const imageUrl = await uploadProductImage(supabase, vendorId, productId, item.imageFile);
    const { error } = await supabase
      .from("products")
      .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("vendor_id", vendorId);
    if (error) throw error;
  }

  const prices: Record<string, number | null> = {};
  for (const item of items) prices[item.name] = item.price;
  // 一覧の保存を先にする。掃除はそのあとにするので、保存に失敗したときに、一覧に残る商品の行が消えていることがない
  await updateVendor(supabase, vendorId, {
    main_products: items.map((item) => item.name),
    main_product_prices: prices,
  });

  // 画面に出ていた商品（主な商品が空のときは products の商品）のうち、一覧から外したもの。
  // 看板商品は別の質問で決めたものなので残す。画面に出ていなかった行には触らない
  const kept = new Set(items.map((item) => item.name));
  const shown = new Set(mainProducts.length > 0 ? mainProducts : rows.map((row) => row.name));
  const removed = rows.filter((row) => shown.has(row.name) && !kept.has(row.name) && row.name !== signatureName);
  if (removed.length === 0) return;

  // 説明や旬は「マイショップ」の画面で登録するもので、行を消すと一緒に消える（product_seasons は on delete cascade）。
  // それらを持つ行は残して写真だけ外し、何も持たない行（写真のために作った行など）だけ消す
  const { data: seasonRows, error: seasonError } = await supabase
    .from("product_seasons")
    .select("product_id")
    .in("product_id", removed.map((row) => row.id));
  if (seasonError) throw seasonError;
  const withSeason = new Set(((seasonRows ?? []) as { product_id: string }[]).map((row) => row.product_id));

  for (const row of removed) {
    if (row.description?.trim() || withSeason.has(row.id)) {
      if (row.image_url) {
        const { error } = await supabase
          .from("products")
          .update({ image_url: null, updated_at: new Date().toISOString() })
          .eq("id", row.id)
          .eq("vendor_id", vendorId);
        if (error) throw error;
      }
    } else {
      const { error } = await supabase.from("products").delete().eq("id", row.id).eq("vendor_id", vendorId);
      if (error) throw error;
    }
    await removeProductImageFiles(supabase, vendorId, row.id);
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
      if (!answer.imageFile) {
        await updateVendor(supabase, vendorId, { shop_image_url: null });
        // 消した写真を公開の URL のまま残さない。消せなくても、答えを消すことは止めない
        await removeStoreImages(supabase, vendorId);
        return;
      }
      const imageUrl = await uploadStoreImage(vendorId, answer.imageFile);
      // 毎回同じパスに上書きされるので、版をつけてブラウザの古いキャッシュを避ける
      return updateVendor(supabase, vendorId, { shop_image_url: `${imageUrl}?v=${Date.now()}` });
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
    case "products":
      return saveProducts(supabase, vendorId, answer.items);
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
