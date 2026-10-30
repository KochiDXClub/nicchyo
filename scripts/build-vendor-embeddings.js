const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ENV_PATH = path.resolve(process.cwd(), ".env.local");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value.replace(/^"(.*)"$/, "$1");
    }
  });
}

function buildContent(row) {
  const parts = [
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
  ].filter(Boolean);

  return parts.join("\n");
}

async function fetchRows(supabase, from, to) {
  const [
    { data: vendorsData, error: vendorsError },
    { data: productsData, error: productsError },
    { data: locationsData, error: locationsError },
    { data: assignmentsData, error: assignmentsError },
    { data: contentsData, error: contentsError },
  ] = await Promise.all([
    supabase
      .from("vendors")
      .select(
        "id, shop_name, owner_name, strength, style, style_tags, schedule, main_products, categories(name)"
      )
      .order("id", { ascending: true })
      .range(from, to),
    supabase.from("products").select("vendor_id, name"),
    supabase
      .from("market_locations")
      .select("id, store_number, latitude, longitude, district"),
    supabase.from("location_assignments").select("vendor_id, location_id, market_date"),
    supabase
      .from("vendor_contents")
      .select("vendor_id, body, created_at")
      .order("created_at", { ascending: false }),
  ]);

  if (vendorsError) throw new Error(`Supabase error: ${vendorsError.message}`);
  if (productsError) throw new Error(`Supabase error: ${productsError.message}`);
  if (locationsError) throw new Error(`Supabase error: ${locationsError.message}`);
  if (assignmentsError) throw new Error(`Supabase error: ${assignmentsError.message}`);
  if (contentsError) throw new Error(`Supabase error: ${contentsError.message}`);

  const productsByVendorId = new Map();
  for (const row of productsData ?? []) {
    if (!row?.vendor_id || !row.name) continue;
    const list = productsByVendorId.get(row.vendor_id) ?? [];
    list.push(row.name);
    productsByVendorId.set(row.vendor_id, list);
  }

  const latestAssignmentByVendorId = new Map();
  for (const row of assignmentsData ?? []) {
    if (!row?.vendor_id || !row.location_id) continue;
    const current = latestAssignmentByVendorId.get(row.vendor_id);
    if (!current) {
      latestAssignmentByVendorId.set(row.vendor_id, row);
      continue;
    }
    const currentDate = current.market_date ? new Date(current.market_date) : null;
    const nextDate = row.market_date ? new Date(row.market_date) : null;
    if (!currentDate || (nextDate && nextDate > currentDate)) {
      latestAssignmentByVendorId.set(row.vendor_id, row);
    }
  }

  const locationById = new Map(
    (locationsData ?? [])
      .filter((row) => row && row.id)
      .map((row) => [row.id, row])
  );

  const latestContentByVendorId = new Map();
  for (const row of contentsData ?? []) {
    if (!row?.vendor_id || latestContentByVendorId.has(row.vendor_id)) continue;
    latestContentByVendorId.set(row.vendor_id, row.body ?? "");
  }

  return (vendorsData ?? []).map((vendor) => {
    const assignment = latestAssignmentByVendorId.get(vendor.id);
    const location = assignment?.location_id
      ? locationById.get(assignment.location_id)
      : null;
    const category = Array.isArray(vendor.categories)
      ? vendor.categories[0]?.name ?? ""
      : vendor.categories?.name ?? "";

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
}

async function fetchEmbeddings(apiKey, inputs) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: inputs,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.data.map((item) => item.embedding);
}

async function main() {
  loadEnvFile(ENV_PATH);

  const apiKey = process.env.OPENAI_API_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!apiKey) throw new Error("OPENAI_API_KEY is missing.");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is missing.");
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const pageSize = 50;
  let from = 0;
  let totalProcessed = 0;

  while (true) {
    const rows = await fetchRows(supabase, from, from + pageSize - 1);
    if (!rows || rows.length === 0) break;

    const embeddingRows = rows
      .map((row) => {
        const content = buildContent(row);
        if (!row.vendor_id || !content) return null;
        return {
          vendor_id: row.vendor_id,
          store_number: row.store_number,
          shop_name: row.shop_name,
          content,
        };
      })
      .filter(Boolean);

    if (embeddingRows.length === 0) {
      from += pageSize;
      continue;
    }

    const embeddings = await fetchEmbeddings(
      apiKey,
      embeddingRows.map((row) => row.content)
    );

    const payload = embeddingRows.map((row, index) => ({
      vendor_id: row.vendor_id,
      store_number: row.store_number,
      shop_name: row.shop_name,
      content: row.content,
      embedding: embeddings[index],
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("vendor_embeddings")
      .upsert(payload, { onConflict: "vendor_id" });

    if (error) {
      throw new Error(`Upsert error: ${error.message}`);
    }

    totalProcessed += payload.length;
    console.log(`Processed ${totalProcessed} vendors...`);
    from += pageSize;
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
