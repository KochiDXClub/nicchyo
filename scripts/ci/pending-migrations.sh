#!/usr/bin/env bash
# `supabase db push --dry-run` の出力から「未適用のマイグレーションファイル」を取り出す。
# migrations-deploy.yml の dry-run ジョブと apply ジョブが共用する（承認した差分と適用する差分の一致確認用）。
#
# 使い方: scripts/ci/pending-migrations.sh <dry-run 出力ファイル> <未適用一覧の出力先>
# 標準出力: 一覧の sha256（0件のときは "none"）
set -euo pipefail

dry_run_output="$1"
out="$2"
migrations_dir="${MIGRATIONS_DIR:-supabase/migrations}"

: > "$out"
# 出力から <14桁>_<名前>.sql を拾い、リポジトリに実在するファイルだけを残す
for f in $(grep -oE '[0-9]{14}_[A-Za-z0-9_]+\.sql' "$dry_run_output" | sort -u || true); do
  if [ -f "$migrations_dir/$f" ]; then
    echo "$f" >> "$out"
  fi
done

if [ -s "$out" ]; then
  sha256sum "$out" | cut -d' ' -f1
else
  echo "none"
fi
