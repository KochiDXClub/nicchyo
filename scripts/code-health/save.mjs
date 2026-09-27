// Supabase の code_health_snapshots テーブルへスナップショットを保存する。
// CI（main への push）から service role で呼ぶ想定。
//
// summary/files は analyze() の戻り値をそのまま保存すると重い（全ファイルの ruleHits など）ため、
// 管理画面の表示に必要な形へ間引いてから保存する。
//
// 1件 INSERT するだけなので @supabase/supabase-js は使わず PostgREST を直接叩く
// （supabase-js は realtime クライアントを内蔵しており、Node 22 未満だとネイティブ
// WebSocket が無いというだけで初期化に失敗する。CI・本番の Node 24 では問題にならないが、
// ローカルの Node 20 でも同じスクリプトを試せるようにするため）。

import fs from "node:fs";

function loadEnv(path) {
  const env = {};
  if (!fs.existsSync(path)) return env;
  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!key) continue;
    env[key] = value;
  }
  return env;
}

/** 管理画面が使う要約部分（totals・metrics・rules・clones・largeFiles・sameName） */
export function buildSnapshotSummary(report) {
  const { files: _files, ...summary } = report;
  return summary;
}

/** ファイル一覧は content・ruleHits の詳細を落とし、違反件数だけに間引く */
export function buildSnapshotFiles(report) {
  return report.files.map((f) => {
    const violations = Object.values(f.ruleHits ?? {}).reduce((sum, hit) => sum + hit.count, 0);
    return {
      path: f.path,
      kind: f.kind,
      role: f.role,
      area: f.area,
      lines: f.lines,
      dupLines: f.dupLines,
      dupRatio: f.lines === 0 ? 0 : Math.round((f.dupLines / f.lines) * 1000) / 10,
      violations,
    };
  });
}

export function loadSupabaseEnv(envPath = ".env.local") {
  const env = { ...loadEnv(envPath), ...process.env };
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY.");
  }
  return { url, serviceKey };
}

/**
 * @param {ReturnType<import("./analyze.mjs").analyze>} report
 * @param {{ commit: string, branch: string }} meta
 * @param {{ url: string, serviceKey: string }} supabaseEnv
 */
export async function saveSnapshot(report, meta, supabaseEnv) {
  const res = await fetch(`${supabaseEnv.url}/rest/v1/code_health_snapshots`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseEnv.serviceKey,
      Authorization: `Bearer ${supabaseEnv.serviceKey}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      commit: meta.commit,
      branch: meta.branch,
      summary: buildSnapshotSummary(report),
      files: buildSnapshotFiles(report),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`code_health_snapshots への保存に失敗しました: ${res.status} ${body}`);
  }
}
