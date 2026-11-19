import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AdminApiContext } from "@/lib/auth/requireAdminApi";
import { parseCsv } from "@/lib/csv/parseCsv";
import { requestEmbeddings } from "@/lib/ai/openaiFetch";
import { fetchAssignmentRows, fetchLocationRows, fetchProductRows } from "@/lib/shops/baseRowQueries";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";

// ---- 型定義 ----

interface VendorRow {
  id: string;
  shop_name: string | null;
  strength: string | null;
  style: string | null;
  style_tags: string[] | null;
  schedule: string[] | null;
  main_products: string[] | null;
  categories: { name: string }[] | { name: string } | null;
}

interface LocationRow {
  id: string;
  store_number: number | null;
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
  store_number: number | null;
  shop_name: string;
  content: string;
}

// ---- ヘルパー ----

// 出店者本人の氏名（vendor_owner_profiles.owner_name）は個人情報のため
// 埋め込みの入力に含めない。OpenAI へ送るのは店舗としての公開情報だけに限る。
function buildContent(row: {
  shop_name: string;
  category: string;
  store_number: number | null;
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
    row.category ? `category: ${row.category}` : "",
    row.store_number != null ? `store_number: ${row.store_number}` : "",
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

/**
 * 1回（最大 50 件）の埋め込みを待つ上限。詰まったら例外にして、!ok のときと同じく同期を失敗にする
 * （待ち続けて maxDuration で強制終了されるより、ログに原因が残る）
 */
const EMBEDDING_BATCH_TIMEOUT_MS = 30_000;

async function fetchEmbeddings(apiKey: string, inputs: string[], runSignal: AbortSignal): Promise<string[]> {
  const signal = AbortSignal.any([runSignal, AbortSignal.timeout(EMBEDDING_BATCH_TIMEOUT_MS)]);
  const response = await requestEmbeddings(apiKey, inputs, signal);

  if (!response.ok) {
    throw new Error(`OpenAI embeddings: HTTP ${response.status}`);
  }

  const { data } = await response.json() as { data: { index: number; embedding: number[] }[] };
  const ordered = [...data].sort((a, b) => a.index - b.index);
  if (ordered.length !== inputs.length || ordered.some((item, index) => item.index !== index || item.embedding?.length !== 1536)) {
    throw new Error("Unexpected OpenAI embeddings response.");
  }
  return ordered.map((item) => JSON.stringify(item.embedding));
}

// ---- メイン処理 ----

type SyncOptions = {
  supabase: AdminApiContext["adminClient"];
  apiKey: string;
  runId: string;
  signal: AbortSignal;
  recordProcessed: (count: number) => void;
};

export async function syncVendorEmbeddings({ supabase, apiKey, runId, signal, recordProcessed }: SyncOptions) {
  // 公開投稿の読み取り条件に合わせる（20261007100000_fix_rls_review_findings.sql）。
  const publicContentCutoff = new Date(Date.now() - 31 * 24 * 60 * 60_000).toISOString();

  // 全データを並列取得
  const [vendors, products, locations, assignments, contents] = await Promise.all([
    fetchAllRows<VendorRow>(
      (from, to) =>
        supabase
          .from("vendors")
          .select("id, shop_name, strength, style, style_tags, schedule, main_products, categories(name)")
          // service_role は RLS を通らない。掲載を許可された店舗だけを埋め込む。
          .eq("listing_status", "allowed")
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: VendorRow[] | null; error: { message: string } | null }>,
      { label: "vendors" }
    ),
    fetchProductRows<ProductRow>(supabase),
    fetchLocationRows<LocationRow>(supabase),
    fetchAssignmentRows<AssignmentRow>(supabase),
    fetchAllRows<ContentRow>(
      (from, to) =>
        supabase
          .from("vendor_contents")
          .select("vendor_id, body, created_at")
          .eq("status", "active")
          .gt("created_at", publicContentCutoff)
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      { label: "vendor_contents" }
    ),
  ]);
  for (const [table, result] of Object.entries({ vendors, products, locations, assignments, contents })) {
    if (result.error || result.truncated) {
      throw new Error(`${table}: ${result.error?.message ?? "source rows were truncated"}`);
    }
  }

  // インデックス構築
  const productsByVendorId = new Map<string, string[]>();
  for (const row of products.data) {
    if (!row?.vendor_id || !row.name) continue;
    const list = productsByVendorId.get(row.vendor_id) ?? [];
    list.push(row.name);
    productsByVendorId.set(row.vendor_id, list);
  }

  const latestAssignmentByVendorId = new Map<string, AssignmentRow>();
  for (const row of assignments.data) {
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
    locations.data.filter((r) => r?.id).map((r) => [r.id, r])
  );

  const latestContentByVendorId = new Map<string, string>();
  for (const row of contents.data) {
    if (!row?.vendor_id || latestContentByVendorId.has(row.vendor_id)) continue;
    latestContentByVendorId.set(row.vendor_id, row.body ?? "");
  }

  // 行を組み立て
  const allRows = vendors.data.map((vendor) => {
    const assignment = latestAssignmentByVendorId.get(vendor.id);
    const location = assignment?.location_id ? locationById.get(assignment.location_id) : null;
    const category = Array.isArray(vendor.categories)
      ? vendor.categories[0]?.name ?? ""
      : (vendor.categories as { name: string } | null)?.name ?? "";

    return {
      vendor_id: vendor.id,
      shop_name: vendor.shop_name ?? "",
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

    const embeddings = await fetchEmbeddings(apiKey, embeddingRows.map((r) => r.content), signal);
    signal.throwIfAborted();
    const payload = embeddingRows.map((row, idx) => ({
      vendor_id: row.vendor_id,
      store_number: row.store_number,
      shop_name: row.shop_name,
      content: row.content,
      embedding: embeddings[idx],
    }));

    const { error } = await supabase.rpc("stage_embedding_batch", { p_run_id: runId, p_rows: payload });
    if (error) throw new Error(`Vendor staging: ${error.message}`);
    recordProcessed(payload.length);
  }
}

export async function syncKnowledgeEmbeddings({ supabase, apiKey, runId, signal, recordProcessed }: SyncOptions) {
  const csv = await readFile(join(process.cwd(), "data", "knowledge.csv"), "utf8");
  const [header = [], ...rows] = parseCsv(csv);
  const columns = ["id", "category", "title", "content", "image_url"] as const;
  const indices = columns.map((key) => header.indexOf(key));
  if (indices.includes(-1) || rows.length === 0) {
    throw new Error("The knowledge CSV is empty or has an invalid header.");
  }
  const ids = new Set<string>();
  const entries = rows.map((row) => {
    const [id, category, title, content, imageUrl] = indices.map((index) => row[index]?.trim() ?? "");
    if (!id || !content || ids.has(id)) throw new Error("Invalid or duplicate knowledge CSV entry.");
    ids.add(id);
    return { id, category, title, content, image_url: imageUrl || null };
  });

  const batchSize = 50;
  for (let offset = 0; offset < entries.length; offset += batchSize) {
    const batch = entries.slice(offset, offset + batchSize);
    const inputs = batch.map(({ title, category, content }) => [title, category, content].filter(Boolean).join("\n"));
    const embeddings = await fetchEmbeddings(apiKey, inputs, signal);
    signal.throwIfAborted();
    const { error } = await supabase.rpc("stage_embedding_batch", {
      p_run_id: runId,
      p_rows: batch.map((entry, index) => ({ ...entry, embedding: embeddings[index] })),
    });
    if (error) throw new Error(`Knowledge staging: ${error.message}`);
    recordProcessed(batch.length);
  }
}
