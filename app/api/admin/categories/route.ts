import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole, isAdmin } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface Category {
  id: string;
  name: string;
  created_at: string | null;
}

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

export async function GET() {
  const { error } = await authorizeAdmin();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data, error: dbError } = await dc
    .from("categories")
    .select("id, name, created_at")
    .order("name", { ascending: true });

  if (dbError) {
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ categories: data as Category[] });
}

export async function POST(req: Request) {
  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = await req.json() as { name?: string };
  const name = (body.name ?? "").trim();

  if (!name || name.length > 50) {
    return NextResponse.json({ error: "カテゴリ名は1〜50文字で入力してください" }, { status: 400 });
  }

  // 重複チェック
  const { data: existing } = await dc
    .from("categories")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "同じ名前のカテゴリがすでに存在します" }, { status: 409 });
  }

  const { data, error: dbError } = await dc
    .from("categories")
    .insert({ name })
    .select("id, name, created_at")
    .single();

  if (dbError) {
    return NextResponse.json({ error: "作成に失敗しました" }, { status: 500 });
  }

  await dc.from("admin_audit_logs").insert({
    admin_id: user.id,
    action: "category_created",
    target_type: "category",
    target_id: (data as Category).id,
    details: { name },
  });

  return NextResponse.json({ category: data as Category }, { status: 201 });
}
