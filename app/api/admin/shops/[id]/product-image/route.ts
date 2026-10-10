import { NextResponse } from "next/server";
import sharp from "sharp";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { guardAdminShopWrite } from "@/lib/admin/shopApiGuard";
import { sniffImageType } from "@/lib/admin/imageSniff";
import {
  PRODUCT_IMAGE_BUCKET,
  ownProductImagePath,
  productImagePath,
  removeProductImageFiles,
} from "@/lib/admin/productImages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 受け取る写真の上限。ブラウザで 1200px に縮めたもの（数百KB）が届く前提。Vercel の本文の上限（4.5MB）に収まる値にして、エラーの文言と実際をそろえる */
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_BYTES + 1024 * 1024;
/** 保存する写真の長辺（出店者本人の保存と同じ 1200px） */
const MAX_DIMENSION = 1200;
const WEBP_QUALITY = 82;
/** 極端に大きな画像で、メモリを使い切られないようにする */
const MAX_INPUT_PIXELS = 24_000_000;
const MAX_NAME_LENGTH = 60;

/**
 * 運営が現地で撮った商品写真の保存。出店者本人の保存（askService.ts の saveProducts）と同じく、
 * products テーブルの「同じ名前の商品」の行に置く。出店者のアカウントと紐づく前の店舗でも、service_role で書ける。
 *
 * 店舗写真（../image）と同じ決まり:
 *   - 写真は公開バケットに置かれ、保存すると来訪者に出うる。写真の使用許可（photo_use_allowed）を記録していない店舗には保存しない
 *   - 形式は Content-Type ではなく中身から判定する
 * 加えて、ここでは受け取った写真を必ず WebP に変換して保存する（向きを直し、撮影場所などの付随情報は残さない）。
 * 保存済みの主な商品（vendors.main_products）の名前だけを受け付ける。未保存の商品名に行を作ると、掃除されない行が残る。
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await guardAdminShopWrite(request, params, { bucket: "admin-product-image", limit: 120 });
    if ("error" in guard) return guard.error;
    const { user, role, adminClient, ip, id } = guard.ctx;

    // 本文を読む前に、大きすぎるものを断る
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_REQUEST_BYTES) return NextResponse.json({ error: "写真が大きすぎます" }, { status: 413 });

    const { data: vendor } = await adminClient
      .from("vendors")
      .select("shop_name, photo_use_allowed, main_products")
      .eq("id", id)
      .maybeSingle();
    if (!vendor) return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });
    if (!vendor.photo_use_allowed) {
      return NextResponse.json({ error: "写真の使用許可が記録されていません。先に許可を記録してください" }, { status: 403 });
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "リクエストの形が正しくありません" }, { status: 400 });
    }
    const name = typeof form.get("name") === "string" ? (form.get("name") as string).trim() : "";
    const photo = form.get("photo");
    if (name === "" || name.length > MAX_NAME_LENGTH) {
      return NextResponse.json({ error: "商品名が正しくありません" }, { status: 400 });
    }
    if (!(photo instanceof Blob)) return NextResponse.json({ error: "写真が送られていません" }, { status: 400 });
    if (photo.size > MAX_BYTES) return NextResponse.json({ error: "写真が大きすぎます（4MBまで）" }, { status: 413 });
    if (!(vendor.main_products ?? []).includes(name)) {
      return NextResponse.json({ error: "先に商品を保存してから、写真を登録してください" }, { status: 400 });
    }

    const bytes = new Uint8Array(await photo.arrayBuffer());
    if (!sniffImageType(bytes)) return NextResponse.json({ error: "写真の形式が正しくありません" }, { status: 400 });

    let webp: Buffer;
    try {
      webp = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
    } catch {
      return NextResponse.json({ error: "写真を読み込めませんでした" }, { status: 400 });
    }

    // 同じ名前の商品の行（看板商品など、出店者本人が作ったものを含む）に写真を置く。無ければ作る
    const { data: existing, error: findError } = await adminClient
      .from("products")
      .select("id, image_url")
      .eq("vendor_id", id)
      .eq("name", name)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (findError) return NextResponse.json({ error: "写真を保存できませんでした" }, { status: 500 });
    let productId = existing?.id;
    if (!productId) {
      const { data: created, error: insertError } = await adminClient
        .from("products")
        .insert({ vendor_id: id, name })
        .select("id")
        .single();
      if (insertError || !created) return NextResponse.json({ error: "写真を保存できませんでした" }, { status: 500 });
      productId = created.id;
    }

    const path = productImagePath(id, productId);
    const upload = await adminClient.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(path, webp, { contentType: "image/webp", upsert: true });
    if (upload.error) return NextResponse.json({ error: "写真を保存できませんでした" }, { status: 500 });

    // 同じ名前で上書きしても、ブラウザが古い写真を出し続けないよう版を付ける
    const url = `${adminClient.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
    const { error: updateError } = await adminClient
      .from("products")
      .update({ image_url: url, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("vendor_id", id);
    if (updateError) {
      // URL を書けなかった。前の写真がこのファイルでなければ、参照されない写真を残さない（前の写真は消さない）
      if (ownProductImagePath(existing?.image_url, id) !== path) {
        await adminClient.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]).catch(() => undefined);
      }
      return NextResponse.json({ error: "写真の URL を保存できませんでした" }, { status: 500 });
    }
    // URL を書けてから、前の写真（別の形式・前の商品 id のもの）を片付ける。先に消すと、書き損ねたときに壊れた URL が残る
    await removeProductImageFiles(adminClient, id, productId, { keepPath: path, imageUrl: existing?.image_url });

    await logAdminAudit(
      adminClient,
      { id: user.id, email: user.email, role },
      {
        action: "product_image_upload",
        targetType: "vendor",
        targetId: id,
        targetName: (vendor.shop_name ?? id).slice(0, 500),
        details: `商品写真を代理でアップロード: ${name}`,
        ipAddress: ip,
      },
    );

    return NextResponse.json({ ok: true, name, url });
  } catch {
    return NextResponse.json({ error: "写真を保存できませんでした" }, { status: 500 });
  }
}

/**
 * 商品の写真を外す。掲載の許可を取り下げた店舗でも外せるよう、許可の確認はしない。
 * 商品の行は残し（看板商品や、ほかの項目を持つ行を消さないため）、URL を空にして写真ファイルを消す。
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await guardAdminShopWrite(request, params, { bucket: "admin-product-image", limit: 120, json: true });
    if ("error" in guard) return guard.error;
    const { user, role, adminClient, ip, id } = guard.ctx;

    const rawName = (guard.body as { name?: unknown } | null)?.name;
    const name = typeof rawName === "string" ? rawName.trim() : "";
    if (name === "" || name.length > MAX_NAME_LENGTH) {
      return NextResponse.json({ error: "商品名が正しくありません" }, { status: 400 });
    }

    const { data: vendor } = await adminClient.from("vendors").select("shop_name").eq("id", id).maybeSingle();
    if (!vendor) return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });

    // 同じ名前の行が複数あることがある（名前の一意制約は無い）。写真のある行を全部外す
    const { data: found, error: findError } = await adminClient
      .from("products")
      .select("id, image_url")
      .eq("vendor_id", id)
      .eq("name", name);
    if (findError) return NextResponse.json({ error: "写真を外せませんでした" }, { status: 500 });
    const withPhoto = (found ?? []).filter((row) => row.image_url);
    // 写真が無い（行が無い）なら、すでに外れている
    if (withPhoto.length === 0) return NextResponse.json({ ok: true, name });

    let cleaned = true;
    for (const product of withPhoto) {
      const { error: updateError } = await adminClient
        .from("products")
        .update({ image_url: null, updated_at: new Date().toISOString() })
        .eq("id", product.id)
        .eq("vendor_id", id);
      if (updateError) return NextResponse.json({ error: "写真を外せませんでした" }, { status: 500 });
      if (!(await removeProductImageFiles(adminClient, id, product.id, { imageUrl: product.image_url }))) cleaned = false;
    }

    await logAdminAudit(
      adminClient,
      { id: user.id, email: user.email, role },
      {
        action: "product_image_delete",
        targetType: "vendor",
        targetId: id,
        targetName: (vendor.shop_name ?? id).slice(0, 500),
        details: `商品写真を代理で削除: ${name}`,
        ipAddress: ip,
      },
    );

    // 写真ファイルを消し切れなかったときは、画面から外れていても公開 URL が残りうるので知らせる
    return NextResponse.json({ ok: true, name, ...(cleaned ? {} : { cleanup: "partial" }) });
  } catch {
    return NextResponse.json({ error: "写真を外せませんでした" }, { status: 500 });
  }
}
