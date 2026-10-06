import { NextResponse } from "next/server";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { guardAdminShopWrite } from "@/lib/admin/shopApiGuard";
import { IMAGE_EXT, sniffImageType } from "@/lib/admin/imageSniff";
import { revalidatePublicShops } from "@/app/(public)/map/services/shopCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "vendor-images";
/** バケットの上限（5MB）に合わせる。メインとサムネイルの 2 枚ぶん */
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_BYTES + 1024 * 1024;

/**
 * 運営が現地で撮った店舗写真の保存。ブラウザで圧縮したメイン（1200px）とサムネイル（160px）を受け取り、
 * 出店者本人の保存（app/vendor/_services/storeService.ts の uploadStoreImage）と同じ名前で置く
 * （サムネイルの URL は lib/shopImages.ts がメインの URL から組み立てるため、名前を変えない）。
 * 出店者のアカウントと紐づく前の店舗でも、service_role で書ける。
 *
 * 写真は公開バケットに置かれ、保存すると来訪者に出る。写真の使用許可（photo_use_allowed）を記録していない
 * 店舗には保存しない。形式は Content-Type ではなく、中身から判定する。
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

    const mainBytes = new Uint8Array(await main.arrayBuffer());
    const thumbBytes = new Uint8Array(await thumb.arrayBuffer());
    const mainType = sniffImageType(mainBytes);
    if (!mainType) return NextResponse.json({ error: "写真の形式が正しくありません" }, { status: 400 });
    // サムネイルは store-thumb.webp の名前で置くので、WebP だけを保存する。WebP を書き出せないブラウザでは
    // JPEG / PNG が送られてくるが、名前と中身が食い違うと、あとで拡張子で判断する処理が誤動作するので、
    // サムネイルは保存しない（メインの保存は成功させる。本人の保存 storeService と同じく、サムネイルの失敗は警告にとどめる）
    const thumbIsWebp = sniffImageType(thumbBytes) === "image/webp";

    const mainPath = `${id}/store-main.${IMAGE_EXT[mainType]}`;
    const thumbPath = `${id}/store-thumb.webp`;
    const storage = adminClient.storage.from(BUCKET);

    const mainResult = await storage.upload(mainPath, mainBytes, { contentType: mainType, upsert: true });
    if (mainResult.error) return NextResponse.json({ error: "写真を保存できませんでした" }, { status: 500 });
    if (thumbIsWebp) {
      const thumbResult = await storage.upload(thumbPath, thumbBytes, { contentType: "image/webp", upsert: true });
      if (thumbResult.error) console.warn("[admin/shops/image] サムネイルの保存に失敗しました:", thumbResult.error.message);
    } else {
      console.warn("[admin/shops/image] サムネイルが WebP ではないので保存しませんでした");
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
    const { error: updateError } = await adminClient
      .from("vendors")
      .update({ shop_image_url: url, updated_at: new Date().toISOString() })
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
        details: "店舗写真を代理でアップロード",
        ipAddress: ip,
      },
    );

    revalidatePublicShops();
    return NextResponse.json({ ok: true, url });
  } catch {
    return NextResponse.json({ error: "写真を保存できませんでした" }, { status: 500 });
  }
}
