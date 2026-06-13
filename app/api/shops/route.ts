import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchVendorShopsFromDb } from "@/app/(public)/map/services/shopDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ shops: [] }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  try {
    const shops = await fetchVendorShopsFromDb(supabase);
    return NextResponse.json({ shops }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ shops: [] }, { status: 500 });
  }
}
