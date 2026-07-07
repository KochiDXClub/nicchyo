import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/permissions";
import { createAdminClient, authorizeAdmin } from "../_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const { id } = await params;
  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = await req.json() as { name?: string };
  const name = (body.name ?? "").trim();

  if (!name || name.length > 50) {
    return NextResponse.json({ error: "カテゴリ名は1〜50文字で入力してください" }, { status: 400 });
  }

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
    .update({ name })
    .eq("id", id)
    .select("id, name, created_at")
    .maybeSingle();

  if (dbError || !data) {
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }

  await dc.from("admin_audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    actor_role: getRole(user),
    action: "category_updated",
    target_type: "category",
    target_id: id,
    details: JSON.stringify({ name }),
  });

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

  await dc.from("admin_audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    actor_role: getRole(user),
    action: "category_deleted",
    target_type: "category",
    target_id: id,
    details: JSON.stringify({}),
  });

  return NextResponse.json({ ok: true });
}
