import { noStoreHeaders } from "@/lib/http/cacheHeaders";
import { NextResponse } from "next/server";
import { fetchCategories } from "@/lib/categories/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ categories: await fetchCategories() }, { headers: noStoreHeaders() }); }
  catch { return NextResponse.json({ error: "カテゴリの取得に失敗しました" }, { status: 503 }); }
}
