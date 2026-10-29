import { NextResponse } from "next/server";
import sharp from "sharp";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { guardAdminShopWrite } from "@/lib/admin/shopApiGuard";
import { sniffImageType, type SniffedImageType } from "@/lib/admin/imageSniff";
import { STORE_IMAGE_CONFIG, type ResizeOptions } from "@/lib/image/clientCompression";
import { isEquirectangularPhoto } from "@/lib/image/panorama";
import { normalizeShopImageKind } from "@/lib/shopImages";
import { revalidatePublicShops } from "@/app/(public)/map/services/shopCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "vendor-images";
/** バケットの上限（5MB）に合わせる。メインとサムネイルの 2 枚ぶん */
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_BYTES + 1024 * 1024;
/** 極端に大きな画像で、メモリを使い切られないようにする（商品写真の保存と同じ） */
const MAX_INPUT_PIXELS = 24_000_000;

/**
 * WebP でなければ、ブラウザでの縮小と同じ大きさ・画質の WebP にする。
 * WebP を書き出せないブラウザ（iPhone の Safari など）からは JPEG や PNG で届く。
 * そのまま置くと、サムネイルが store-thumb.webp の名前で置けず、地図の丸窓が重いメインの写真を読みに行く
 */
async function ensureWebp(bytes: Uint8Array, type: SniffedImageType, options: ResizeOptions): Promise<Uint8Array> {
  if (type === "image/webp") return bytes;
  return sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize(options.maxDimension, options.maxDimension, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: Math.round(options.quality * 100) })
    .toBuffer();
}

/**
 * 運営が現地で撮った店舗写真の保存。ブラウザで圧縮したメイン（1200px）とサムネイル（400px）を受け取り、
 * 出店者本人の保存（app/vendor/_services/storeService.ts の uploadStoreImage）と同じ名前で置く
 * （サムネイルの URL は lib/shopImages.ts がメインの URL から組み立てるため、名前を変えない）。
 * 出店者のアカウントと紐づく前の店舗でも、service_role で書ける。
 *
 * 写真は公開バケットに置かれ、保存すると来訪者に出る。写真の使用許可（photo_use_allowed）を記録していない
 * 店舗には保存しない。形式は Content-Type ではなく、中身から判定する。
 * WebP でない写真は WebP に変換して保存する（商品写真の保存 ../product-image と同じ）。
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await guardAdminShopWrite(request, params, { bucket: "admin-shop-image", limit: 60 });
    if ("error" in guard) return guard.error;
    const { user, role, adminClient, ip, id } = guard.ctx;

    // 本文を読む前に、大きすぎるものを断る
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_REQUEST_BYTES * 2) return NextResponse.json({ error: "写真が大きすぎます" }, { status: 413 });

    const { data: vendor } = await adminClient
      .from("vendors")
      .select("shop_name, photo_use_allowed")
      .eq("id", id)
      .maybeSingle();
    if (!vendor) return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });
    if (!vendor.photo_use_allowed) {
      return NextResponse.json({ error: "写真の使用許可が記録されていません。先に許可を記録してください" }, { status: 403 });
    }

    const form = await request.formData();
    const main = form.get("main");
    const thumb = form.get("thumb");
    if (!(main instanceof Blob) || !(thumb instanceof Blob)) {
      return NextResponse.json({ error: "写真が送られていません" }, { status: 400 });
    }
    if (main.size > MAX_BYTES || thumb.size > MAX_BYTES) {
      return NextResponse.json({ error: "写真が大きすぎます（5MBまで）" }, { status: 413 });
    }

    // 写真の種類（普通／全周）。送られていなければ普通の写真
    const kind = normalizeShopImageKind(form.get("kind"));
    const mainBytes = new Uint8Array(await main.arrayBuffer());
    const thumbBytes = new Uint8Array(await thumb.arrayBuffer());
    const mainType = sniffImageType(mainBytes);
    if (!mainType) return NextResponse.json({ error: "写真の形式が正しくありません" }, { status: 400 });
    let mainWebp: Uint8Array;
    try {
      mainWebp = await ensureWebp(mainBytes, mainType, STORE_IMAGE_CONFIG.main);
    } catch {
      return NextResponse.json({ error: "写真を読み込めませんでした" }, { status: 400 });
    }
    // 全周写真は横:縦 = 2:1 の写真だけ。そうでない写真に全周のラベルが付くと、来訪者の画面で歪んで見える
    if (kind === "panorama") {
      const meta = await sharp(mainWebp).metadata().catch(() => null);
      if (!meta?.width || !meta.height || !isEquirectangularPhoto(meta.width, meta.height)) {
        return NextResponse.json({ error: "全周写真は、横:縦が 2:1 の写真だけ登録できます" }, { status: 400 });
      }
    }
    // サムネイルの失敗は警告にとどめ、メインの保存は成功させる（本人の保存 storeService と同じ）
    const thumbType = sniffImageType(thumbBytes);
    const thumbWebp = thumbType
      ? await ensureWebp(thumbBytes, thumbType, STORE_IMAGE_CONFIG.thumbnail).catch(() => null)
      : null;

    const mainPath = `${id}/store-main.webp`;
    const thumbPath = `${id}/store-thumb.webp`;
    const storage = adminClient.storage.from(BUCKET);

    const mainResult = await storage.upload(mainPath, mainWebp, { contentType: "image/webp", upsert: true });
    if (mainResult.error) return NextResponse.json({ error: "写真を保存できませんでした" }, { status: 500 });
    if (thumbWebp) {
      const thumbResult = await storage.upload(thumbPath, thumbWebp, { contentType: "image/webp", upsert: true });
      if (thumbResult.error) console.warn("[admin/shops/image] サムネイルの保存に失敗しました:", thumbResult.error.message);
    } else {
      console.warn("[admin/shops/image] サムネイルを読み込めなかったので保存しませんでした");
    }

    // 今回のもの以外の store-main.*（形式が変わったときの前回分）を消す。消せなくても保存自体は成功
    try {
      const { data: files } = await storage.list(id);
      const stale = (files ?? [])
        .filter((f) => f.name.startsWith("store-main.") && `${id}/${f.name}` !== mainPath)
        .map((f) => `${id}/${f.name}`);
      if (stale.length > 0) await storage.remove(stale);
    } catch (error) {
      console.warn("[admin/shops/image] 古い写真の掃除に失敗しました:", error);
    }

    const url = storage.getPublicUrl(mainPath).data.publicUrl;
    const updatedAt = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from("vendors")
      .update({ shop_image_url: url, shop_image_kind: kind, updated_at: updatedAt })
      .eq("id", id);
    if (updateError) return NextResponse.json({ error: "写真の URL を保存できませんでした" }, { status: 500 });

    await logAdminAudit(
      adminClient,
      { id: user.id, email: user.email, role },
      {
        action: "shop_image_upload",
        targetType: "vendor",
        targetId: id,
        targetName: (vendor.shop_name ?? id).slice(0, 500),
        details: kind === "panorama" ? "店舗写真（全周）を代理でアップロード" : "店舗写真を代理でアップロード",
        ipAddress: ip,
      },
    );

    revalidatePublicShops();
    // 画面が次の保存（updated_at による競合検知）で 409 にならないよう、新しい updated_at も返す
    return NextResponse.json({ ok: true, url, kind, updated_at: updatedAt });
  } catch {
    return NextResponse.json({ error: "写真を保存できませんでした" }, { status: 500 });
  }
}
