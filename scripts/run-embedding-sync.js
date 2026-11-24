const { existsSync } = require("node:fs");

module.exports = async function runEmbeddingSync(target) {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const { EMBEDDING_SYNC_URL, CRON_SECRET } = process.env;
  if (!EMBEDDING_SYNC_URL || !CRON_SECRET) {
    throw new Error("Set EMBEDDING_SYNC_URL to the application origin and CRON_SECRET to the same value as the server.");
  }

  const url = new URL("/api/admin/sync-embeddings", EMBEDDING_SYNC_URL);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
    throw new Error("EMBEDDING_SYNC_URL must use HTTPS or point to localhost.");
  }

  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    headers: { Authorization: `Bearer ${CRON_SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({ target }),
    signal: AbortSignal.timeout(310_000),
  });
  if (!response.ok) throw new Error(`Embedding sync failed (HTTP ${response.status}). Check the admin history.`);
  const { processed, version } = await response.json();
  console.log(`Published ${target} embedding version ${version} (${processed} rows).`);
};
