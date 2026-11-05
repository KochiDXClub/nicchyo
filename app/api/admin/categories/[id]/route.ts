import { revalidateCategories } from "@/lib/categories/server";
import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/permissions";
import { createAdminClient, authorizeAdmin } from "../_helpers";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { revalidatePublicShops } from "@/app/(public)/map/services/shopCache";
import { revalidateShopTranslations } from "@/lib/i18n/shopTranslation.server";
import { parseCategoryInput } from "@/lib/categories/input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const { id } = await params;
  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = await req.json() as { name?: string; nameEn?: unknown };
  const parsed = parseCategoryInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { name, nameEn } = parsed;

  const { data: existing } = await dc
    .from("categories")
    .select("id")
    .eq("name", name)
    .neq("id", id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "同じ名前のカテゴリがすでに存在します" }, { status: 409 });
  }

  const { data, error: dbError } = await dc
    .from("categories")
    .update({ name, name_en: nameEn })
    .eq("id", id)
    .select("id, name, name_en, created_at")
    .maybeSingle();

  if (dbError || !data) {
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }

  await logAdminAudit(
    dc,
    { id: user.id, email: user.email, role: getRole(user) },
    { action: "category_updated", targetType: "category", targetId: id, details: JSON.stringify({ name, nameEn }) }
  );

  // カテゴリー名はマップの店舗情報に載るため、キャッシュを捨てる
  revalidateCategories();
  revalidatePublicShops();
  revalidateShopTranslations();
  return NextResponse.json({ category: data });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const { id } = await params;
  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: deleted, error: dbError } = await dc
    .from("categories")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (dbError) {
    const isConflict = dbError.code === "23503";
    return NextResponse.json(
      { error: "削除に失敗しました。このカテゴリは他のデータに使用されている可能性があります。" },
      { status: isConflict ? 409 : 500 }
    );
  }

  if (!deleted) {
    return NextResponse.json({ error: "カテゴリが見つかりません" }, { status: 404 });
  }

  await logAdminAudit(
    dc,
    { id: user.id, email: user.email, role: getRole(user) },
    { action: "category_deleted", targetType: "category", targetId: id, details: JSON.stringify({}) }
  );

  revalidateCategories();
  revalidatePublicShops();
  revalidateShopTranslations();
  return NextResponse.json({ ok: true });
}
