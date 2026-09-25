import type { ReactNode } from "react";
import type { BenchmarkReport, FrameStats } from "@/lib/perf/mapBenchmark";
import {
  METRIC_DEFS,
  computeMetrics,
  formatMetric,
  improvementRatio,
  median,
  type MetricValues,
} from "@/lib/perf/metrics";
import type { MapFeatureFlagKey, MapFeatureFlags } from "@/lib/mapFeatureFlags";
import { PillSelect } from "@/components/admin/PillSelect";

export function fmt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return n.toFixed(digits);
}

export function shortSha(sha: string): string {
  return sha ? sha.slice(0, 7) : "-";
}

export function envLabel(env: string): string {
  switch (env) {
    case "production":
      return "本番";
    case "preview":
      return "プレビュー";
    case "local":
      return "ローカル";
    case "cli":
      return "CLI";
    default:
      return env || "不明";
  }
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** フラグを短い文字列にする（例: snap=integrated skip=before iso=on lm=on） */
export function flagsSummary(flags: Record<string, string | boolean> | null | undefined): string {
  if (!flags) return "-";
  const short: Record<string, string> = {
    roadSnap: "snap",
    zoomSkip: "skip",
    zoomRenderIsolation: "iso",
    landmarkCssScale: "lm",
    stallRenderer: "stall",
    backgroundOverlay: "bg",
    tileOpacityByZoom: "tile",
    shopLayerHiding: "hide",
    renderer: "renderer",
    basemap: "basemap",
  };
  return Object.entries(flags)
    .map(([k, v]) => `${short[k] ?? k}=${typeof v === "boolean" ? (v ? "on" : "off") : v}`)
    .join(" ");
}

/** API が返す 1 件（生レポートは含まない） */
export interface RunRow {
  id: string;
  created_at: string;
  label: string;
  branch: string;
  commit_sha: string;
  environment: string;
  deployment_url: string;
  viewport_width: number;
  viewport_height: number;
  device_pixel_ratio: number;
  shop_count: number;
  cpu_throttle: number;
  user_agent: string;
  metrics: MetricValues | null;
  /** 計測時に有効だったマップ動作フラグ（古いログには無い） */
  flags?: Record<string, string | boolean> | null;
}

/** A/B 比較の 1 選択肢ぶんの結果 */
export interface AbVariantResult {
  key: MapFeatureFlagKey;
  variant: string;
  flags: MapFeatureFlags;
  reports: BenchmarkReport[];
}

export function FrameStatsCells({ s }: { s: FrameStats }) {
  return (
    <>
      <td className="px-3 py-2 text-right tabular-nums">{s.frames}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(s.avgMs)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(s.p95Ms)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(s.maxMs)}</td>
      <td className={`px-3 py-2 text-right tabular-nums ${s.droppedFrames > 0 ? "font-semibold text-red-600" : ""}`}>
        {s.droppedFrames}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(s.longTaskMs, 0)}</td>
    </>
  );
}

export function Badge({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return (
    <span className={`rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700 ${mono ? "font-mono" : "font-medium"}`}>
      {children}
    </span>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-bold tabular-nums text-slate-800">{value}</div>
    </div>
  );
}

export function Select({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <PillSelect label={label} value={value} onChange={onChange} disabled={disabled}>
      {children}
    </PillSelect>
  );
}

export function RunSelect({ label, value, onChange, runs }: { label: string; value: string; onChange: (v: string) => void; runs: RunRow[] }) {
  return (
    <PillSelect
      label={label}
      value={value}
      onChange={onChange}
      placeholder="選択"
      menuClassName="min-w-[320px]"
      options={runs.map((r) => ({
        value: r.id,
        label: `${fmtDate(r.created_at)} ${r.label}`.trim(),
        description: `${r.branch} @ ${shortSha(r.commit_sha)} / ${envLabel(r.environment)} / ${flagsSummary(r.flags)}`,
      }))}
    />
  );
}

export function AbComparisonTable({ results }: { results: AbVariantResult[] }) {
  const medians = results.map((v) => {
    const metrics = v.reports.map((r) => computeMetrics(r));
    const out = {} as MetricValues;
    for (const d of METRIC_DEFS) {
      out[d.key] = median(metrics.map((m) => m[d.key]).filter((x): x is number => x !== null));
    }
    return out;
  });
  const first = medians[0];
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">指標（小さいほど良い）</th>
            {results.map((v) => (
              <th key={v.variant} className="px-3 py-2 text-right">
                {v.key} = <span className="font-mono">{v.variant}</span>
              </th>
            ))}
            {results.length === 2 && <th className="px-3 py-2 text-right">改善率（A→B）</th>}
          </tr>
        </thead>
        <tbody>
          {METRIC_DEFS.map((d) => {
            const ratio = results.length === 2 ? improvementRatio(first[d.key], medians[1][d.key]) : null;
            const tone =
              ratio === null || Math.abs(ratio) < 0.05
                ? "text-slate-500"
                : ratio > 0
                  ? "font-semibold text-emerald-600"
                  : "font-semibold text-red-600";
            return (
              <tr key={d.key} className="border-b border-slate-100">
                <td className="px-3 py-2">{d.label}</td>
                {medians.map((m, i) => (
                  <td key={i} className="px-3 py-2 text-right tabular-nums">{formatMetric(m[d.key], d)}</td>
                ))}
                {results.length === 2 && (
                  <td className={`px-3 py-2 text-right tabular-nums ${tone}`}>
                    {ratio === null ? "-" : `${ratio > 0 ? "-" : "+"}${fmt(Math.abs(ratio) * 100, 0)}%`}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">
        A = 最初の選択肢、B = 2 番目。3 つ以上のときは各列を見比べてください。数字は端末状態で揺れるので、回数を 3 以上にして中央値で見るのがおすすめです。
      </p>
    </div>
  );
}
