"use client";

import { useMemo, useState } from "react";
import { compareSnapshots } from "@/lib/code-health/compareSnapshots";
import type { CodeHealthSnapshotRow } from "@/types/database.extensions";
import { CodeTreemap } from "./CodeTreemap";
import { CompositionBar } from "./CompositionBar";
import { CopyBlocks } from "./CopyBlocks";
import { DuplicateNames } from "./DuplicateNames";
import { HugeFilesList } from "./HugeFilesList";
import { MetricTiles } from "./MetricTiles";
import { RulesTable } from "./RulesTable";

export interface CodeHealthDashboardProps {
  snapshots: CodeHealthSnapshotRow[];
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CodeHealthDashboard({ snapshots }: CodeHealthDashboardProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const current = snapshots[selectedIndex] ?? snapshots[0];
  const previous = snapshots[selectedIndex + 1] ?? null;
  const comparison = useMemo(
    () => compareSnapshots(previous?.summary ?? null, current.summary),
    [previous, current]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-white p-4 shadow-card ring-1 ring-line">
        <div className="min-w-0">
          <p className="text-xs text-nicchyo-ink/55">
            {current.branch} ・ {current.commit.slice(0, 7)}
          </p>
          <p className="text-sm font-semibold text-nicchyo-ink tabular-nums">
            {formatDateTime(current.created_at)}
          </p>
        </div>
        {snapshots.length > 1 ? (
          <label className="flex items-center gap-2 text-sm text-nicchyo-ink/70">
            表示するスナップショット
            <select
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(Number(e.target.value))}
              className="rounded-btn border border-line bg-white px-3 py-1.5 text-sm text-nicchyo-ink"
            >
              {snapshots.map((s, i) => (
                <option key={s.id} value={i}>
                  {formatDateTime(s.created_at)}（{s.commit.slice(0, 7)}）
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <MetricTiles metrics={current.summary.metrics} comparison={comparison?.metrics ?? null} />

      <CompositionBar byRole={current.summary.totals.byRole} />

      <CodeTreemap key={current.id} files={current.files} />

      <details className="rounded-card bg-white p-4 ring-1 ring-line">
        <summary>管理APIの認可確認 {current.summary.adminHandlers && `（要確認 ${current.summary.adminHandlers.filter(h => h.guardLine === null).length}件）`}</summary>
        <p className="my-2 text-sm">操作の先頭で共通ガードを呼び、失敗時に戻る形を確認します。独自の分岐や別関数経由の操作は手動確認の対象です。</p>
        {current.summary.adminHandlers ? <ul className="max-h-80 overflow-auto text-sm">
          {[...current.summary.adminHandlers].sort((a, b) => Number(!!a.guardLine) - Number(!!b.guardLine)).map(h =>
            <li key={h.path + h.method} className="break-all py-1">{h.guardLine ? `共通ガード L${h.guardLine}` : "要確認"} · {h.method} {h.path} L{h.line}</li>)}
        </ul> : <p>この記録では未検査です。</p>}
      </details>

      <RulesTable rules={current.summary.rules} comparison={comparison?.rules ?? null} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HugeFilesList largeFiles={current.summary.largeFiles} />
        <DuplicateNames groups={current.summary.sameName} />
      </div>

      <CopyBlocks clones={current.summary.clones} />
    </div>
  );
}
