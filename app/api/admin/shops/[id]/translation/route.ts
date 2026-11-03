import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { guardAdminShopWrite, UUID_RE } from "@/lib/admin/shopApiGuard";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { parseShopTranslationInput } from "@/lib/admin/shopTranslationInput";
import { getVendorTranslation, saveReviewedShopTranslation } from "@/lib/i18n/shopTranslation.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 運営向け（現場登録）: その店の英語版（保存済み）。無ければ translation: null。stale = 訳したあとに日本語が変わった */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const stored = await getVendorTranslation(id, "en");
    return NextResponse.json({ translation: stored });
  } catch {
    return NextResponse.json({ error: "英語版を取得できませんでした" }, { status: 500 });
  }
}

/**
 * 運営が確認・手直しした英語版を保存する（以後、自動の同期で上書きしない）。
 * 日本語の保存（PATCH /api/admin/shops/[id]）のあとに呼ぶ。原文のハッシュは、保存済みの日本語から作る。
 * すべて空なら英語版を消す（自動の同期の対象に戻る）。
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await guardAdminShopWrite(request, params, { bucket: "admin-shop-translation", limit: 120, json: true });
    if ("error" in guard) return guard.error;
    const { user, role, adminClient, ip, id } = guard.ctx;

    const body = guard.body as { stale?: unknown; sourceUpdatedAt?: unknown } | null;
    const parsed = parseShopTranslationInput(guard.body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const result = await saveReviewedShopTranslation({ vendorId: id, locale: "en", translation: parsed.value, stale: body?.stale === true, expectedUpdatedAt: typeof body?.sourceUpdatedAt === "string" ? body.sourceUpdatedAt : null });
    if (result === "not_found") return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });

    const { data: vendor } = await adminClient.from("vendors").select("shop_name").eq("id", id).maybeSingle();
    await logAdminAudit(
      adminClient,
      { id: user.id, email: user.email, role },
      {
        action: "shop_translation_save",
        targetType: "vendor",
        targetId: id,
        targetName: (vendor?.shop_name ?? id).slice(0, 500),
        details: result === "deleted" ? "英語版を消した（自動翻訳の対象に戻る）" : "英語版を確認・手直しして保存（英語）",
        ipAddress: ip,
      },
    );
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[admin/shops/translation]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "英語版を保存できませんでした" }, { status: 500 });
  }
}
