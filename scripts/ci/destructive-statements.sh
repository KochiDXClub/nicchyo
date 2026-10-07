#!/usr/bin/env bash
# 未適用マイグレーションの中から、不可逆・アクセス変更になりうる文を探して出力する。
# 行頭が `--` のコメント行は除外する。該当が無ければ何も出さない。
#
# 使い方: scripts/ci/destructive-statements.sh <未適用一覧ファイル>
set -euo pipefail

list="$1"
migrations_dir="${MIGRATIONS_DIR:-supabase/migrations}"
pattern='\b(drop[[:space:]]+(table|column|function|policy|trigger|index|constraint|type|view|schema)|delete[[:space:]]+from|truncate|revoke)\b'

while read -r f; do
  [ -n "$f" ] || continue
  hits=$(grep -nEi "$pattern" "$migrations_dir/$f" | grep -vE '^[0-9]+:[[:space:]]*--' || true)
  if [ -n "$hits" ]; then
    echo "## $f"
    echo "$hits"
  fi
done < "$list"
