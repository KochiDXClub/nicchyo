import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { revalidatePublicShops } from "@/app/(public)/map/services/shopCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "vendor-images";
/** バケットの上限（5MB）に合わせる */
const MAX_BYTES = 5 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

/**
 * 運営が現地で撮った店舗写真の保存。ブラウザで圧縮したメイン（1200px）とサムネイル（160px）を受け取り、
 * 出店者本人の保存（app/vendor/_services/storeService.ts の uploadStoreImage）と同じ名前で置く
 * （サムネイルの URL は lib/shopImages.ts がメインの URL から組み立てるため、名前を変えない）。
 * 出店者のアカウントと紐づく前の店舗でも、service_role で書ける。
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "admin-shop-image",
      limit: 60,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;
    const { user, role, adminClient } = auth;

    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const { data: vendor } = await adminClient.from("vendors").select("shop_name").eq("id", id).maybeSingle();
    if (!vendor) return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });

    const form = await request.formData();
    const main = form.get("main");
    const thumb = form.get("thumb");
    if (!(main instanceof Blob) || !(thumb instanceof Blob)) {
      return NextResponse.json({ error: "写真が送られていません" }, { status: 400 });
    }
    const mainExt = EXT_BY_TYPE[main.type];
    if (!mainExt || !EXT_BY_TYPE[thumb.type]) {
      return NextResponse.json({ error: "写真の形式が正しくありません" }, { status: 400 });
    }
    if (main.size > MAX_BYTES || thumb.size > MAX_BYTES) {
      return NextResponse.json({ error: "写真が大きすぎます（5MBまで）" }, { status: 413 });
    }

    const mainPath = `${id}/store-main.${mainExt}`;
    const thumbPath = `${id}/store-thumb.webp`;
    const storage = adminClient.storage.from(BUCKET);

    const mainResult = await storage.upload(mainPath, main, { contentType: main.type, upsert: true });
    if (mainResult.error) return NextResponse.json({ error: "写真を保存できませんでした" }, { status: 500 });
    const thumbResult = await storage.upload(thumbPath, thumb, { contentType: thumb.type, upsert: true });
    if (thumbResult.error) console.warn("[admin/shops/image] サムネイルの保存に失敗しました:", thumbResult.error.message);

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

    const ip = getClientIp(request);
    await logAdminAudit(
      adminClient,
      { id: user.id, email: user.email, role },
      {
        action: "shop_image_upload",
        targetType: "vendor",
        targetId: id,
        targetName: (vendor.shop_name ?? id).slice(0, 500),
        details: "店舗写真を代理でアップロード",
        ipAddress: ip !== "unknown" ? ip : null,
      },
    );

    revalidatePublicShops();
    return NextResponse.json({ ok: true, url });
  } catch {
    return NextResponse.json({ error: "写真を保存できませんでした" }, { status: 500 });
  }
}
