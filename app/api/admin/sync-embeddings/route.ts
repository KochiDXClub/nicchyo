import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5分（大量店舗の処理に対応）

// ---- 型定義 ----

interface VendorRow {
  id: string;
  shop_name: string | null;
  owner_name: string | null;
  strength: string | null;
  style: string | null;
  style_tags: string[] | null;
  schedule: string[] | null;
  main_products: string[] | null;
  categories: { name: string }[] | { name: string } | null;
}

interface LocationRow {
  id: string;
  store_number: string | null;
  latitude: number | null;
  longitude: number | null;
  district: string | null;
}

interface AssignmentRow {
  vendor_id: string;
  location_id: string;
  market_date: string | null;
}

interface ProductRow {
  vendor_id: string;
  name: string;
}

interface ContentRow {
  vendor_id: string;
  body: string | null;
}

interface EmbeddingRow {
  vendor_id: string;
  store_number: string | null;
  shop_name: string;
  content: string;
}

// ---- ヘルパー ----

function buildContent(row: {
  shop_name: string;
  owner_name: string;
  category: string;
  store_number: string | null;
  district: string;
  latitude: number | null;
  longitude: number | null;
  strength: string;
  style: string;
  style_tags: string[];
  schedule: string[];
  main_products: string[];
  products: string[];
  latest_content: string;
}): string {
  return [
    row.shop_name ? `shop: ${row.shop_name}` : "",
    row.owner_name ? `owner: ${row.owner_name}` : "",
    row.category ? `category: ${row.category}` : "",
    row.store_number ? `store_number: ${row.store_number}` : "",
    row.district ? `district: ${row.district}` : "",
    row.latitude ? `lat: ${row.latitude}` : "",
    row.longitude ? `lng: ${row.longitude}` : "",
    row.strength ? `strength: ${row.strength}` : "",
    row.style ? `style: ${row.style}` : "",
    row.style_tags?.length ? `style_tags: ${row.style_tags.join(", ")}` : "",
    row.schedule?.length ? `schedule: ${row.schedule.join("、")}` : "",
    row.main_products?.length ? `main_products: ${row.main_products.join(", ")}` : "",
    row.products?.length ? `products: ${row.products.join(", ")}` : "",
    row.latest_content ? `latest_content: ${row.latest_content}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function fetchEmbeddings(apiKey: string, inputs: string[]): Promise<number[][]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: inputs }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${text}`);
  }

  const data = await response.json();
  return (data.data as { embedding: number[] }[]).map((item) => item.embedding);
}

// ---- メイン処理 ----

async function syncVendorEmbeddings(): Promise<{ processed: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!apiKey) throw new Error("OPENAI_API_KEY is missing.");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
  if (!supabaseUrl) throw new Error("SUPABASE_URL is missing.");

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // 全データを並列取得
  const [
    { data: vendorsData, error: vendorsError },
    { data: productsData, error: productsError },
    { data: locationsData, error: locationsError },
    { data: assignmentsData, error: assignmentsError },
    { data: contentsData, error: contentsError },
  ] = await Promise.all([
    supabase
      .from("vendors")
      .select("id, shop_name, owner_name, strength, style, style_tags, schedule, main_products, categories(name)")
      .order("id", { ascending: true }),
    supabase.from("products").select("vendor_id, name"),
    supabase.from("market_locations").select("id, store_number, latitude, longitude, district"),
    supabase.from("location_assignments").select("vendor_id, location_id, market_date"),
    supabase.from("vendor_contents").select("vendor_id, body, created_at").order("created_at", { ascending: false }),
  ]);

  if (vendorsError) throw new Error(`vendors: ${vendorsError.message}`);
  if (productsError) throw new Error(`products: ${productsError.message}`);
  if (locationsError) throw new Error(`locations: ${locationsError.message}`);
  if (assignmentsError) throw new Error(`assignments: ${assignmentsError.message}`);
  if (contentsError) throw new Error(`contents: ${contentsError.message}`);

  // インデックス構築
  const productsByVendorId = new Map<string, string[]>();
  for (const row of (productsData as ProductRow[]) ?? []) {
    if (!row?.vendor_id || !row.name) continue;
    const list = productsByVendorId.get(row.vendor_id) ?? [];
    list.push(row.name);
    productsByVendorId.set(row.vendor_id, list);
  }

  const latestAssignmentByVendorId = new Map<string, AssignmentRow>();
  for (const row of (assignmentsData as AssignmentRow[]) ?? []) {
    if (!row?.vendor_id || !row.location_id) continue;
    const current = latestAssignmentByVendorId.get(row.vendor_id);
    if (!current) { latestAssignmentByVendorId.set(row.vendor_id, row); continue; }
    const currentDate = current.market_date ? new Date(current.market_date) : null;
    const nextDate = row.market_date ? new Date(row.market_date) : null;
    if (!currentDate || (nextDate && nextDate > currentDate)) {
      latestAssignmentByVendorId.set(row.vendor_id, row);
    }
  }

  const locationById = new Map<string, LocationRow>(
    ((locationsData as LocationRow[]) ?? []).filter((r) => r?.id).map((r) => [r.id, r])
  );

  const latestContentByVendorId = new Map<string, string>();
  for (const row of (contentsData as ContentRow[]) ?? []) {
    if (!row?.vendor_id || latestContentByVendorId.has(row.vendor_id)) continue;
    latestContentByVendorId.set(row.vendor_id, row.body ?? "");
  }

  // 行を組み立て
  const allRows = ((vendorsData as VendorRow[]) ?? []).map((vendor) => {
    const assignment = latestAssignmentByVendorId.get(vendor.id);
    const location = assignment?.location_id ? locationById.get(assignment.location_id) : null;
    const category = Array.isArray(vendor.categories)
      ? vendor.categories[0]?.name ?? ""
      : (vendor.categories as { name: string } | null)?.name ?? "";

    return {
      vendor_id: vendor.id,
      shop_name: vendor.shop_name ?? "",
      owner_name: vendor.owner_name ?? "",
      category,
      strength: vendor.strength ?? "",
      style: vendor.style ?? "",
      style_tags: vendor.style_tags ?? [],
      schedule: vendor.schedule ?? [],
      main_products: vendor.main_products ?? [],
      products: productsByVendorId.get(vendor.id) ?? [],
      latest_content: latestContentByVendorId.get(vendor.id) ?? "",
      store_number: location?.store_number ?? null,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      district: location?.district ?? "",
    };
  });

  // バッチ処理（50件ずつ）
  const PAGE_SIZE = 50;
  let totalProcessed = 0;

  for (let i = 0; i < allRows.length; i += PAGE_SIZE) {
    const batch = allRows.slice(i, i + PAGE_SIZE);
    const embeddingRows: EmbeddingRow[] = batch
      .map((row) => {
        const content = buildContent(row);
        if (!row.vendor_id || !content) return null;
        return { vendor_id: row.vendor_id, store_number: row.store_number, shop_name: row.shop_name, content };
      })
      .filter((r): r is EmbeddingRow => r !== null);

    if (embeddingRows.length === 0) continue;

    const embeddings = await fetchEmbeddings(apiKey, embeddingRows.map((r) => r.content));
    const payload = embeddingRows.map((row, idx) => ({
      vendor_id: row.vendor_id,
      store_number: row.store_number,
      shop_name: row.shop_name,
      content: row.content,
      embedding: embeddings[idx],
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("vendor_embeddings")
      .upsert(payload, { onConflict: "vendor_id" });

    if (error) throw new Error(`Upsert error: ${error.message}`);
    totalProcessed += payload.length;
  }

  return { processed: totalProcessed };
}

// ---- ルートハンドラー ----

function checkAuth(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return process.env.NODE_ENV !== "production";
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  return token === cronSecret;
}

// Vercel Cron は GET を送る
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startedAt = new Date().toISOString();
    const { processed } = await syncVendorEmbeddings();
    return NextResponse.json({ ok: true, processed, startedAt, finishedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[sync-embeddings]", message);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

// 手動実行用（管理画面等から POST で叩く場合）
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startedAt = new Date().toISOString();
    const { processed } = await syncVendorEmbeddings();
    return NextResponse.json({ ok: true, processed, startedAt, finishedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[sync-embeddings]", message);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
