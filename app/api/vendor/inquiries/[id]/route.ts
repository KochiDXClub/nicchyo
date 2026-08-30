import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClientWithExtensions } from "@/utils/supabase/server";
import { requireVendorRole } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

// ─── GET: スレッド詳細+返信一覧（自分のスレッドのみ） ─────────────
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const cookieStore = await cookies();
  const supabase = createClientWithExtensions(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireVendorRole(user);
  if (forbidden) return forbidden;

  const { data: inquiry, error: inquiryError } = await supabase
    .from("vendor_inquiries")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (inquiryError) {
    console.error("[vendor/inquiries/:id] fetch error:", inquiryError.message);
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }
  // RLSにより他人のスレッドはそもそも取得できないが、念のため明示的にも確認する
  if (!inquiry || inquiry.vendor_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: replies, error: repliesError } = await supabase
    .from("vendor_inquiry_replies")
    .select("*")
    .eq("inquiry_id", id)
    .order("created_at", { ascending: true });

  if (repliesError) {
    console.error("[vendor/inquiries/:id] replies fetch error:", repliesError.message);
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ inquiry, replies });
}
