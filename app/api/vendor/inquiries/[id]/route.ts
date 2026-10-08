import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClientWithExtensions } from "@/utils/supabase/server";
import { requireVendorContext } from "@/lib/vendor/shopContext.server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { isUuid } from "@/lib/vendorInquiries/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

// ─── GET: スレッド詳細+返信一覧（自分のスレッドのみ） ─────────────
export async function GET(request: Request, { params }: RouteParams) {
  // GETは状態を変えないが、管理側の詳細GETと防御レベルを揃えておく
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const { id } = await params;
  // uuid型の列に非UUIDを渡すとPostgreSQLが22P02を返し500になるため、先に弾く
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const auth = await requireVendorContext({ permission: "inquiries" });
  if (!auth.ok) return auth.response;
  const { vendorId } = auth;
  // vendor_inquiries は生成済み型に無いので、拡張型のクライアントで読み書きする（認証は上で済み）
  const supabase = createClientWithExtensions(await cookies());

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
  if (!inquiry || inquiry.vendor_id !== vendorId) {
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
