// 本番デプロイ（Vercel の production ビルド）のときだけ、コード健康診断の結果を
// Supabase の code_health_snapshots に保存する。package.json の prebuild から呼ばれる。
//
// - キーは Vercel に登録済みの SUPABASE_SERVICE_ROLE_KEY を使う（GitHub Actions 側には置かない）
// - CI・プレビュー・ローカルの npm run build では何もしない
// - 同じコミットの Redeploy では保存しない
// - 失敗してもビルドは止めない（管理画面の履歴が1回分抜けるだけなので）

import { spawnSync } from "node:child_process";
import { loadSupabaseEnv, snapshotExists } from "./save.mjs";

async function main() {
  if (process.env.VERCEL_ENV !== "production") return;

  const supabaseEnv = loadSupabaseEnv();
  const commit = process.env.VERCEL_GIT_COMMIT_SHA;
  if (commit && (await snapshotExists(commit, supabaseEnv))) {
    console.log(`コード健康診断: ${commit.slice(0, 7)} は保存済みのためスキップします`);
    return;
  }

  const result = spawnSync(process.execPath, ["scripts/code-health/cli.mjs", "--save"], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`code-health:save が終了コード ${result.status} で失敗しました`);
}

main().catch((error) => {
  console.warn(`⚠️ コード健康診断のスナップショット保存に失敗しました（ビルドは続行します）: ${error.message}`);
});
