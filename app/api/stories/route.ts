import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

// 近況フィードの取得上限（際限なくレスポンスが膨らむのを防ぐ）
const STORIES_LIMIT = 100;

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from("vendor_contents")
    .select(`
      id,
      body,
      image_url,
      expires_at,
      created_at,
      vendor:vendor_id (
        id,
        shop_name,
        shop_image_url
      )
    `)
    // RLS の「vendors can read own contents」ポリシー（状態・期限条件なし）が
    // OR 結合されるため、本人の hidden/deleted 投稿が混ざらないよう status を明示する
    .eq("status", "active")
    .not("image_url", "is", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(STORIES_LIMIT);

  if (error) {
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
