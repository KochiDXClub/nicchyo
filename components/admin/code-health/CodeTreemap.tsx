"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ROLES } from "@/scripts/code-health/rules.mjs";
import {
  colorStep,
  DUP_RATIO_CUTS,
  SEQUENTIAL_PALETTE,
  squarify,
  VIOLATION_CUTS,
} from "@/lib/code-health/treemap";
import type { SnapshotFile } from "@/lib/code-health/types";
import { Modal } from "@/components/admin";

export interface CodeTreemapProps {
  files: SnapshotFile[];
}

type ColorMode = "role" | "dup" | "violations";

const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.id, r.label]));
const ROLE_COLOR: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.id, r.color]));

const MODE_LABEL: Record<ColorMode, string> = {
  role: "機能ごと",
  dup: "コピペ率",
  violations: "ルール違反数",
};

const HEIGHT = 480;

function colorOf(file: SnapshotFile, mode: ColorMode): string {
  if (mode === "dup") {
    const ratio = file.lines > 0 ? (file.dupLines / file.lines) * 100 : 0;
    return SEQUENTIAL_PALETTE[colorStep(ratio, DUP_RATIO_CUTS)];
  }
  if (mode === "violations") {
    return SEQUENTIAL_PALETTE[colorStep(file.violations, VIOLATION_CUTS)];
  }
  return ROLE_COLOR[file.role] ?? ROLE_COLOR.other;
}

/**
 * colorStep() は cuts（境界値、要素数 N）に対して 0〜N の段階を返す
 * （0: ちょうど0、1〜N-1: 前後の境界の間、N: 最後の境界を超える）。
 * SEQUENTIAL_PALETTE は N+1 色を持つので、凡例も 0〜N の全段階を出す
 */
function legendLabel(step: number, cuts: number[], unit: string): string {
  if (step === 0) return `0${unit}`;
  if (step === cuts.length) return `${cuts[cuts.length - 1]}${unit}超`;
  return `${cuts[step - 1]}〜${cuts[step]}${unit}`;
}

export function CodeTreemap({ files }: CodeTreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [mode, setMode] = useState<ColorMode>("role");
  const [focusRole, setFocusRole] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<SnapshotFile | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const areaLayout = useMemo(() => {
    const byArea = new Map<string, SnapshotFile[]>();
    for (const f of files) {
      const list = byArea.get(f.area) ?? [];
      list.push(f);
      byArea.set(f.area, list);
    }
    const groups = [...byArea.entries()].map(([area, areaFiles]) => ({
      area,
      files: areaFiles,
      value: areaFiles.reduce((s, f) => s + f.lines, 0),
    }));
    if (width <= 0) return [];
    return squarify(groups, 0, 0, width, HEIGHT);
  }, [files, width]);

  return (
    <section className="rounded-card bg-white p-4 shadow-card ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-nicchyo-ink">ファイルの分布（ツリーマップ）</h2>
        <div className="flex gap-1 rounded-btn bg-nicchyo-base p-1 text-xs">
          {(Object.keys(MODE_LABEL) as ColorMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded-chip px-3 py-1 font-semibold ${
                mode === m ? "bg-white text-nicchyo-ink shadow-chip" : "text-nicchyo-ink/55"
              }`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="relative mt-3" style={{ height: HEIGHT }}>
        {areaLayout.map((area, i) => {
          const fileRects = squarify(
            area.item.files.map((f) => ({ ...f, value: f.lines })),
            area.x + 1,
            area.y + 15,
            Math.max(area.w - 2, 0),
            Math.max(area.h - 16, 0)
          );
          return (
            <div
              key={area.item.area || i}
              className="absolute overflow-hidden ring-1 ring-white"
              style={{ left: area.x, top: area.y, width: area.w, height: area.h }}
            >
              {area.w > 60 && area.h > 34 ? (
                <p className="truncate bg-nicchyo-base px-1.5 text-[11px] leading-[15px] text-nicchyo-ink/55">
                  {area.item.area}
                </p>
              ) : null}
              {fileRects.map((t) => {
                const f = t.item;
                const dimmed = mode === "role" && focusRole !== null && f.role !== focusRole;
                return (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => setSelectedFile(f)}
                    title={`${f.path}\n${f.lines}行 / ${ROLE_LABEL[f.role] ?? f.role}`}
                    className="absolute border border-white/60 transition-opacity"
                    style={{
                      left: t.x - area.x,
                      top: t.y - area.y,
                      width: Math.max(t.w, 1),
                      height: Math.max(t.h, 1),
                      background: colorOf(f, mode),
                      opacity: dimmed ? 0.2 : 1,
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {mode === "role"
          ? ROLES.map((role) => (
              <button
                key={role.id}
                type="button"
                aria-pressed={focusRole === role.id}
                onClick={() => setFocusRole(focusRole === role.id ? null : role.id)}
                className="flex items-center gap-1.5 text-nicchyo-ink/70 aria-pressed:font-semibold aria-pressed:text-nicchyo-ink"
              >
                <span className="h-2.5 w-2.5 rounded-chip" style={{ background: role.color }} aria-hidden="true" />
                {role.label}
              </button>
            ))
          : (() => {
              const cuts = mode === "dup" ? DUP_RATIO_CUTS : VIOLATION_CUTS;
              const unit = mode === "dup" ? "%" : "件";
              return SEQUENTIAL_PALETTE.map((color, step) => (
                <span key={step} className="flex items-center gap-1.5 text-nicchyo-ink/70">
                  <span className="h-2.5 w-2.5 rounded-chip" style={{ background: color }} aria-hidden="true" />
                  {legendLabel(step, cuts, unit)}
                </span>
              ));
            })()}
      </div>

      <Modal open={selectedFile !== null} onClose={() => setSelectedFile(null)} title={selectedFile?.path ?? ""}>
        {selectedFile ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-nicchyo-ink">
            <dt className="text-nicchyo-ink/55">機能</dt>
            <dd>{ROLE_LABEL[selectedFile.role] ?? selectedFile.role}</dd>
            <dt className="text-nicchyo-ink/55">まとまり</dt>
            <dd>{selectedFile.area}</dd>
            <dt className="text-nicchyo-ink/55">行数</dt>
            <dd className="tabular-nums">{selectedFile.lines.toLocaleString()}</dd>
            <dt className="text-nicchyo-ink/55">コピペ行数</dt>
            <dd className="tabular-nums">
              {selectedFile.dupLines.toLocaleString()}（{selectedFile.dupRatio}%）
            </dd>
            <dt className="text-nicchyo-ink/55">ルール違反数</dt>
            <dd className="tabular-nums">{selectedFile.violations}</dd>
          </dl>
        ) : null}
      </Modal>
    </section>
  );
}
