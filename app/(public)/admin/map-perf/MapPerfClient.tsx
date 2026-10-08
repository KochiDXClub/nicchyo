"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { METRIC_DEFS, formatMetric, improvementRatio, type MetricKey } from "@/lib/perf/metrics";
import type { BuildInfo } from "@/lib/perf/buildInfo";
import {
  DEFAULT_MAP_FEATURE_FLAGS,
  MAP_FEATURE_FLAG_DEFS,
  type MapFeatureFlagKey,
} from "@/lib/mapFeatureFlags";
import { useMapPerfState, REPEATS, SHOP_COUNTS, VIEWPORTS, type ShopCountKey, type ViewportKey } from "./useMapPerfState";
import {
  AbComparisonTable,
  Badge,
  FrameStatsCells,
  RunSelect,
  Select,
  Stat,
  envLabel,
  flagsSummary,
  fmt,
  fmtDate,
  shortSha,
} from "./MapPerfPieces";

export default function MapPerfClient({ buildInfo }: { buildInfo: BuildInfo }) {
  const s = useMapPerfState(buildInfo);

  return (
    <div className="space-y-8">
      {/* ビルド情報 */}
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm shadow-sm">
        <span className="text-slate-500">計測対象のコード</span>
        <Badge>{envLabel(buildInfo.environment)}</Badge>
        <Badge mono>{buildInfo.branch || "(ブランチ不明)"}</Badge>
        <Badge mono>{shortSha(buildInfo.commitSha)}</Badge>
        {buildInfo.deploymentUrl && <span className="truncate text-xs text-slate-400">{buildInfo.deploymentUrl}</span>}
      </section>

      {/* 操作 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Select label="画面サイズ" value={s.viewport} disabled={s.running} onChange={(v) => { s.setViewport(v as ViewportKey); s.reload(); }}>
            {VIEWPORTS.map((v) => (
              <option key={v.key} value={v.key}>{v.label}</option>
            ))}
          </Select>
          <Select label="店舗数" value={s.shopCount} disabled={s.running} onChange={(v) => { s.setShopCount(v as ShopCountKey); s.reload(); }}>
            {SHOP_COUNTS.map((sh) => (
              <option key={sh.key} value={sh.key}>{sh.label}</option>
            ))}
          </Select>
          <Select label="回数" value={String(s.repeat)} disabled={s.running} onChange={(v) => s.setRepeat(Number(v) as (typeof REPEATS)[number])}>
            {REPEATS.map((n) => (
              <option key={n} value={n}>{n} 回</option>
            ))}
          </Select>
          <button type="button" onClick={s.reload} disabled={s.running} className="rounded-full border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            マップを再読込
          </button>
          <button type="button" onClick={s.run} disabled={!s.ready || s.running} className="rounded-full bg-nicchyo-primary px-5 py-1.5 text-sm font-semibold text-nicchyo-ink shadow hover:brightness-95 disabled:opacity-50">
            {s.running ? "計測中…" : "計測を実行"}
          </button>
          <span className="text-sm text-slate-500">{s.ready ? (s.running ? s.progress : "準備完了") : "マップを読み込み中…"}</span>
        </div>
        {/* 実験スイッチ */}
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded accent-nicchyo-primary"
                checked={s.flagOverride !== null}
                disabled={s.running}
                onChange={(e) => {
                  s.setFlagOverride(e.target.checked ? { ...DEFAULT_MAP_FEATURE_FLAGS } : null);
                  s.reload();
                }}
              />
              実験スイッチを使う（マップ動作フラグを URL で上書き）
            </label>
            {s.flagOverride === null && (
              <span className="text-xs text-slate-500">オフのときは本番設定（管理画面「設定」）のまま計測します</span>
            )}
          </div>
          {s.flagOverride && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              {MAP_FEATURE_FLAG_DEFS.map((def) =>
                def.options === "boolean" ? (
                  <label key={def.key} className="flex items-center gap-1.5 text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-nicchyo-primary"
                      checked={Boolean(s.flagOverride![def.key])}
                      disabled={s.running}
                      onChange={(e) => {
                        s.setFlagOverride({ ...s.flagOverride!, [def.key]: e.target.checked });
                        s.reload();
                      }}
                    />
                    {def.label}
                  </label>
                ) : (
                  <Select
                    key={def.key}
                    label={def.label}
                    value={String(s.flagOverride![def.key])}
                    disabled={s.running}
                    onChange={(v) => {
                      s.setFlagOverride({ ...s.flagOverride!, [def.key]: v });
                      s.reload();
                    }}
                  >
                    {def.options.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </Select>
                )
              )}
            </div>
          )}
        </div>

        {/* A/B 比較 */}
        <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium text-slate-700">A/B 比較</span>
            <Select label="比較する要素" value={s.compareKey} disabled={s.running} onChange={(v) => s.setCompareKey(v as MapFeatureFlagKey | "")}>
              <option value="">選択</option>
              {MAP_FEATURE_FLAG_DEFS.map((def) => (
                <option key={def.key} value={def.key}>{def.label}</option>
              ))}
            </Select>
            <button
              type="button"
              onClick={s.runCompare}
              disabled={!s.compareKey || s.running}
              className="rounded-full bg-amber-500 px-5 py-1.5 text-sm font-semibold text-white shadow hover:brightness-95 disabled:opacity-50"
            >
              {s.abRunning ? "比較計測中…" : "全選択肢をまとめて計測"}
            </button>
            <span className="text-xs text-slate-500">
              選んだ要素の各選択肢について、マップを読み直して {s.repeat} 回ずつ計測します。他のフラグは実験スイッチの値（未使用なら既定値）で固定します。
            </span>
          </div>
        </div>
        {s.error && <p className="mt-3 text-sm text-red-600">{s.error}</p>}
        <p className="mt-3 text-xs text-slate-500">
          計測中はこのタブを前面にしたまま触らないでください。数字は端末やブラウザの状態で揺れるので、3 回以上取って中央値で比べるのがおすすめです。
          CPU を遅くした条件（スマホ相当）で測りたいときは Chrome の DevTools で CPU throttling を有効にするか、CLI の <code className="rounded bg-slate-100 px-1">node scripts/map-bench.mjs</code> を使ってください。
        </p>
      </section>

      {/* マップ本体 */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mx-auto overflow-hidden rounded-xl border border-slate-300 bg-white shadow" style={{ width: s.vp.width, maxWidth: "100%" }}>
          <iframe
            key={s.frameKey}
            ref={s.iframeRef}
            src={s.iframeSrc}
            title="計測用マップ"
            width={s.vp.width}
            height={s.vp.height}
            className="block"
            style={{ width: s.vp.width, height: s.vp.height, maxWidth: "100%", border: 0 }}
          />
        </div>
      </section>

      {/* A/B 比較の結果 */}
      {s.abResults.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-800">
              A/B 比較の結果{s.repeat > 1 ? `（各 ${s.repeat} 回の中央値）` : ""}
            </h2>
            <div className="flex items-center gap-2">
              <input value={s.label} onChange={(e) => s.setLabel(e.target.value)} placeholder="ラベル（例: SVG vs div）" className="rounded-full border border-slate-300 px-3 py-1.5 text-sm" />
              <button type="button" onClick={s.saveCompare} disabled={s.saving || s.abRunning} className="rounded-full bg-slate-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                {s.saving ? "保存中…" : "全部ログに保存"}
              </button>
              {s.savedNote && <span className="text-sm text-emerald-600">{s.savedNote}</span>}
            </div>
          </div>
          <AbComparisonTable results={s.abResults} />
        </section>
      )}

      {/* 今回の結果 */}
      {s.latest.length > 0 && s.latestMedian && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-800">
              今回の結果{s.latest.length > 1 ? `（${s.latest.length} 回の中央値）` : ""}
            </h2>
            <div className="flex items-center gap-2">
              <input value={s.label} onChange={(e) => s.setLabel(e.target.value)} placeholder="ラベル（例: SVG 化後）" className="rounded-full border border-slate-300 px-3 py-1.5 text-sm" />
              <button type="button" onClick={s.save} disabled={s.saving} className="rounded-full bg-slate-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                {s.saving ? "保存中…" : "ログに保存"}
              </button>
              {s.savedNote && <span className="text-sm text-emerald-600">{s.savedNote}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {METRIC_DEFS.filter((d) => d.primary).map((d) => (
              <Stat key={d.key} label={d.label} value={formatMetric(s.latestMedian![d.key], d)} />
            ))}
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-slate-600">全指標とズーム段階ごとの内訳を見る</summary>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {METRIC_DEFS.filter((d) => !d.primary).map((d) => (
                <Stat key={d.key} label={d.label} value={formatMetric(s.latestMedian![d.key], d)} />
              ))}
            </div>
            {s.latest.map((report, idx) => (
              <div key={idx} className="mt-4 overflow-x-auto">
                {s.latest.length > 1 && <div className="mb-1 text-xs font-semibold text-slate-500">{idx + 1} 回目</div>}
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">場面</th>
                      <th className="px-3 py-2 text-right">フレーム数</th>
                      <th className="px-3 py-2 text-right">平均 ms</th>
                      <th className="px-3 py-2 text-right">p95 ms</th>
                      <th className="px-3 py-2 text-right">最長 ms</th>
                      <th className="px-3 py-2 text-right">コマ落ち</th>
                      <th className="px-3 py-2 text-right">ロングタスク ms</th>
                      <th className="px-3 py-2 text-right">完了まで ms</th>
                      <th className="px-3 py-2 text-right">DOM マーカー / 要素</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="px-3 py-2">アイドル</td>
                      <FrameStatsCells s={report.idle} />
                      <td className="px-3 py-2 text-right">-</td>
                      <td className="px-3 py-2 text-right tabular-nums">{report.dom.markerCount} / {report.dom.markerPaneElements}</td>
                    </tr>
                    {report.zoomSteps.map((z, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="px-3 py-2">ズーム {z.fromZoom} → {z.toZoom}</td>
                        <FrameStatsCells s={z} />
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(z.zoomEndMs, 0)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{z.markerCount} / {z.markerPaneElements}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-slate-100">
                      <td className="px-3 py-2">パン</td>
                      <FrameStatsCells s={report.pan} />
                      <td className="px-3 py-2 text-right">-</td>
                      <td className="px-3 py-2 text-right">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </details>
        </section>
      )}

      {/* 推移グラフ */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-800">推移グラフ</h2>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Select label="指標" value={s.metricKey} onChange={(v) => s.setMetricKey(v as MetricKey)}>
              {METRIC_DEFS.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </Select>
            <Select label="ブランチ" value={s.branchFilter} onChange={s.setBranchFilter}>
              <option value="">すべて</option>
              {s.branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </Select>
            <label className="flex items-center gap-1.5 text-slate-600">
              <input type="checkbox" checked={s.sameConditionOnly} onChange={(e) => s.setSameConditionOnly(e.target.checked)} />
              今の条件（{s.vp.width}×{s.vp.height} / {s.sc.count || "実データ"}）だけ
            </label>
          </div>
        </div>
        {s.chartData.length === 0 ? (
          <p className="text-sm text-slate-500">該当する計測結果がありません。計測して「ログに保存」すると、ここに積み上がります。</p>
        ) : (
          <>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.chartData} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} height={60} />
                  <YAxis tick={{ fontSize: 11 }} unit={s.metricDef.unit === "ms" ? "ms" : ""} />
                  <Tooltip
                    formatter={(v) => [formatMetric(typeof v === "number" ? v : null, s.metricDef), s.metricDef.label]}
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as (typeof s.chartData)[number] | undefined;
                      return p ? `${p.name}\n${p.branch} @ ${p.sha} (${p.env})` : "";
                    }}
                    contentStyle={{ fontSize: 12, whiteSpace: "pre-line" }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {s.chartData.map((d) => (
                      <Cell key={d.id} fill={s.branchColor.get(d.branch) ?? "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
              {s.branches.map((b) => (
                <span key={b} className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.branchColor.get(b) }} />
                  {b}
                </span>
              ))}
              <span className="text-slate-400">小さいほど良い</span>
            </div>
          </>
        )}
      </section>

      {/* 2 件比較 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-800">2 件を比較</h2>
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <RunSelect label="A（変更前）" value={s.compareA} onChange={s.setCompareA} runs={s.filteredRuns} />
          <span className="text-slate-400">→</span>
          <RunSelect label="B（変更後）" value={s.compareB} onChange={s.setCompareB} runs={s.filteredRuns} />
        </div>
        {s.runA && s.runB && s.runA.metrics && s.runB.metrics ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">指標（小さいほど良い）</th>
                  <th className="px-3 py-2 text-right">{s.runA.label} <span className="font-mono text-slate-400">{shortSha(s.runA.commit_sha)}</span></th>
                  <th className="px-3 py-2 text-right">{s.runB.label} <span className="font-mono text-slate-400">{shortSha(s.runB.commit_sha)}</span></th>
                  <th className="px-3 py-2 text-right">改善率</th>
                </tr>
              </thead>
              <tbody>
                {METRIC_DEFS.map((d) => {
                  const a = s.runA!.metrics![d.key];
                  const b = s.runB!.metrics![d.key];
                  const ratio = improvementRatio(a, b);
                  const tone =
                    ratio === null || Math.abs(ratio) < 0.05
                      ? "text-slate-500"
                      : ratio > 0
                        ? "font-semibold text-emerald-600"
                        : "font-semibold text-red-600";
                  return (
                    <tr key={d.key} className="border-b border-slate-100">
                      <td className="px-3 py-2">{d.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMetric(a, d)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMetric(b, d)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${tone}`}>
                        {ratio === null ? "-" : `${ratio > 0 ? "-" : "+"}${fmt(Math.abs(ratio) * 100, 0)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">比較する 2 件を選んでください。</p>
        )}
      </section>

      {/* ログ一覧 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">計測結果ログ</h2>
          <button type="button" onClick={() => void s.loadRuns()} disabled={s.loadingRuns} className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {s.loadingRuns ? "読み込み中…" : "更新"}
          </button>
        </div>
        {s.filteredRuns.length === 0 ? (
          <p className="text-sm text-slate-500">まだ保存された計測結果がありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">日時</th>
                  <th className="px-3 py-2">ラベル</th>
                  <th className="px-3 py-2">ブランチ</th>
                  <th className="px-3 py-2">コミット</th>
                  <th className="px-3 py-2">環境</th>
                  <th className="px-3 py-2">条件</th>
                  <th className="px-3 py-2">フラグ</th>
                  {METRIC_DEFS.filter((d) => d.primary).map((d) => (
                    <th key={d.key} className="px-3 py-2 text-right">{d.label}</th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {s.filteredRuns.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtDate(r.created_at)}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{r.label || "-"}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 font-mono text-xs">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.branchColor.get(r.branch || "(不明)") }} />
                        {r.branch || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{shortSha(r.commit_sha)}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{envLabel(r.environment)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                      {r.viewport_width}×{r.viewport_height} / {r.shop_count || "実"}店 / CPU×{r.cpu_throttle}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-slate-500">{flagsSummary(r.flags)}</td>
                    {METRIC_DEFS.filter((d) => d.primary).map((d) => (
                      <td key={d.key} className="px-3 py-2 text-right tabular-nums">{formatMetric(r.metrics?.[d.key] ?? null, d)}</td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => void s.remove(r.id)} className="text-xs text-slate-400 hover:text-red-600">削除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          CLI からも同じログに保存できます: <code className="rounded bg-slate-100 px-1">node scripts/map-bench.mjs --url http://localhost:3000 --label &quot;変更前&quot; --runs 3 --cpu 4 --save</code>
        </p>
      </section>
    </div>
  );
}
