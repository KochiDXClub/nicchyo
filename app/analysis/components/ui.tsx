import type { ReactNode } from "react";
import { INK } from "../chart";

/**
 * デモ値であることの表示。
 * このページの目的は「偏りを開示した、引用できるデータ」なので、
 * サンプル値が実データに見えてしまうと目的そのものを裏切る。
 * デモ値を出すセクションには必ずこれを付ける。
 */
export function DemoBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
      <span aria-hidden="true">◆</span>
      デモ
    </span>
  );
}

/** 実データであることの表示。デモと並ぶときだけ意味を持つ。 */
export function LiveBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
      <span aria-hidden="true">●</span>
      実データ
    </span>
  );
}

type SectionCardProps = {
  title: string;
  /** 何を数えたものかの一言。定義そのものは footnote に書く。 */
  description?: string;
  demo?: boolean;
  live?: boolean;
  /** 集計方法・母数・欠測の扱い。引用される数字にはこれが要る。 */
  footnote?: ReactNode;
  children: ReactNode;
};

export function SectionCard({
  title,
  description,
  demo = false,
  live = false,
  footnote,
  children,
}: SectionCardProps) {
  return (
    <section className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm md:p-6">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="text-base font-bold text-amber-900 md:text-lg">{title}</h3>
        {demo ? <DemoBadge /> : null}
        {live ? <LiveBadge /> : null}
      </header>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-amber-900/70">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
      {footnote ? (
        <p className="mt-4 border-t border-amber-100 pt-3 text-xs leading-relaxed text-amber-800/80">
          {footnote}
        </p>
      ) : null}
    </section>
  );
}

/** 見出しの下に置く層の区切り。 */
export function LayerHeading({
  step,
  title,
  lead,
}: {
  step: string;
  title: string;
  lead: string;
}) {
  return (
    <div className="mb-4 mt-12 first:mt-0">
      <p className="text-xs font-bold tracking-[0.18em] text-amber-700/80">{step}</p>
      <h2 className="mt-1 text-xl font-bold text-amber-900 md:text-2xl">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-amber-900/70">{lead}</p>
    </div>
  );
}

/**
 * 数字ひとつを見せる札。棒1本のグラフを描くより、数字そのものを出したほうが速い。
 * 大きい数字は等幅にしない（桁が揃う必要がある表だけ tabular-nums にする）。
 */
export function StatTile({
  label,
  value,
  unit,
  sub,
  demo = false,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  demo?: boolean;
}) {
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-amber-900/70">{label}</p>
        {demo ? <DemoBadge /> : null}
      </div>
      <p className="mt-1.5 text-2xl font-bold text-amber-900">
        {value}
        {unit ? <span className="ml-1 text-sm font-semibold text-amber-900/70">{unit}</span> : null}
      </p>
      {sub ? <p className="mt-1 text-[11px] leading-snug text-amber-800/75">{sub}</p> : null}
    </div>
  );
}

/**
 * すべてのチャートに添える表形式の代替表示。
 * 色や図形が読めない環境でも値に到達できるようにするためのもので、
 * 同時に「グラフではなく数字が欲しい人」への最短経路でもある。
 */
export function TableView({
  columns,
  rows,
  caption,
}: {
  columns: string[];
  rows: (string | number)[][];
  caption?: string;
}) {
  return (
    <details className="mt-4 group">
      <summary className="cursor-pointer list-none rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-50">
        <span className="inline-block transition group-open:rotate-90" aria-hidden="true">
          ▶
        </span>{" "}
        数値を表で見る
      </summary>
      <div className="relative mt-2 overflow-x-auto">
        <table className="w-full min-w-[380px] border-collapse text-xs">
          {caption ? (
            <caption className="pb-2 text-left text-[11px] text-amber-800/75">{caption}</caption>
          ) : null}
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="border-b border-amber-200 px-2 py-1.5 text-left font-semibold text-amber-900"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row[0])}>
                {row.map((cell, index) => (
                  <td
                    key={`${row[0]}-${index}`}
                    className={[
                      "border-b border-amber-50 px-2 py-1.5 text-amber-900/90",
                      index === 0 ? "font-medium" : "tabular-nums",
                    ].join(" ")}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * 横スクロールが必要な図・表に添える案内。
 * 画面に収まっているときは出さない（sm 以上では隠す）。
 */
export function ScrollHint() {
  return (
    <p className="mt-1 text-[10px] sm:hidden" style={{ color: INK.muted }}>
      ← 横にスクロールできます →
    </p>
  );
}

/** 系列が2つ以上あるチャートには必ず置く。色だけに意味を持たせないため。 */
export function Legend({
  items,
}: {
  items: { color: string; label: string; glyph?: string }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11px]" style={{ color: INK.secondary }}>
          <span
            aria-hidden="true"
            className="inline-flex h-3 w-3 items-center justify-center rounded-sm text-[8px] font-bold leading-none text-white"
            style={{ backgroundColor: item.color }}
          >
            {item.glyph ?? ""}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
