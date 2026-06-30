import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from("shop_stories")
    .select(`
      id,
      image_url,
      caption,
      posted_at,
      expires_at,
      vendor:vendor_id (
        id,
        shop_name,
        shop_image_url
      )
    `)
    .gt("expires_at", new Date().toISOString())
    .order("posted_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
