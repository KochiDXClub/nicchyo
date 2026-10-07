#!/usr/bin/env bash
# `supabase db push --dry-run` の出力から「未適用のマイグレーションファイル」を取り出す。
# migrations-deploy.yml の dry-run ジョブと apply ジョブが共用する（承認した差分と適用する差分の一致確認用）。
#
# 使い方: scripts/ci/pending-migrations.sh <dry-run 出力ファイル> <未適用一覧の出力先>
# 標準出力: 一覧の sha256（0件のときは "none"）
# 終了コード: 「最新です」と確認できたときだけ 0件(none)。ファイル名を1つも拾えず、最新とも読めない出力は
#   失敗(1)にする。読み取れないまま 0件扱いにすると、apply が承認も求めず黙ってスキップされ、
#   マイグレーション未適用のまま新しいアプリだけがデプロイされるため。
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
elif grep -qi 'up to date' "$dry_run_output"; then
  echo "none"
else
  echo "::error::dry-run の出力から未適用マイグレーションを読み取れませんでした（'up to date' の表示も無し）。supabase CLI の出力形式が変わった可能性があります: $dry_run_output" >&2
  exit 1
fi
