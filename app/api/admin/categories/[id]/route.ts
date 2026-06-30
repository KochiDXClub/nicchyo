import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole, isAdmin } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authorizeAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(getRole(user))) return { user: null, error: "Forbidden" };
  return { user, error: null };
}

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
    admin_id: user.id,
    action: "category_updated",
    target_type: "category",
    target_id: id,
    details: { name },
  });

  return NextResponse.json({ category: data });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const { id } = await params;
  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { error: dbError } = await dc.from("categories").delete().eq("id", id);
  if (dbError) {
    return NextResponse.json({ error: "削除に失敗しました。このカテゴリは他のデータに使用されている可能性があります。" }, { status: 500 });
  }

  await dc.from("admin_audit_logs").insert({
    admin_id: user.id,
    action: "category_deleted",
    target_type: "category",
    target_id: id,
    details: {},
  });

  return NextResponse.json({ ok: true });
}
