import { DIRECTION, INK, SERIES, SURFACE } from "../chart";
import { Legend, TableView } from "./ui";
import type { DemoHourlyDirection, DemoReachRow } from "../demoData";

// ── 共通の横棒 ──────────────────────────────────────────────────────────
// 棒は 14px（上限24px）、データ側の端だけ 4px 丸め、基線側は角のまま。
// 罫線は引かず、面の余白で区切る。

function BarRow({
  label,
  value,
  max,
  display,
  color = SERIES.bar,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  color?: string;
}) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <li className="grid grid-cols-[3.6rem_1fr_2.9rem] items-center gap-2" title={`${label}：${display}`}>
      <span className="text-[11px] font-medium" style={{ color: INK.secondary }}>
        {label}
      </span>
      <span className="block h-3.5 rounded-sm" style={{ backgroundColor: SURFACE.grid }}>
        <span
          className="block h-3.5"
          style={{
            width: `${Math.max(ratio * 100, value > 0 ? 1.5 : 0)}%`,
            backgroundColor: color,
            borderRadius: "0 4px 4px 0",
          }}
        />
      </span>
      <span className="text-right text-[11px] tabular-nums" style={{ color: INK.secondary }}>
        {display}
      </span>
    </li>
  );
}

// ── 時間帯 × 歩く向き ───────────────────────────────────────────────────

// 中央から左右に伸びる図なので、横スクロールさせると初期表示で片側が切れて
// 「東西の量が違う」ように見えてしまう。スクロールさせず、画面幅に合わせて
// 図ごと縮める前提で座標系を組む（文字も一緒に縮むので、基準を大きめに取る）。
const ROW_HEIGHT = 22;
const BAR_HEIGHT = 13;
const LABEL_WIDTH = 38;
const CHART_WIDTH = 460;
const CENTER_GAP = 2;

/** データ側の端だけを丸めた棒。side が伸びる向き。 */
function divergingBarPath(
  center: number,
  y: number,
  length: number,
  side: "left" | "right",
  radius = 4
) {
  const h = BAR_HEIGHT;
  const r = Math.min(radius, length);
  if (length <= 0) return "";
  if (side === "right") {
    const x0 = center + CENTER_GAP;
    const x1 = x0 + length;
    return `M ${x0} ${y} H ${x1 - r} A ${r} ${r} 0 0 1 ${x1} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x1 - r} ${y + h} H ${x0} Z`;
  }
  const x0 = center - CENTER_GAP;
  const x1 = x0 - length;
  return `M ${x0} ${y} H ${x1 + r} A ${r} ${r} 0 0 0 ${x1} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 0 ${x1 + r} ${y + h} H ${x0} Z`;
}

/**
 * 時間帯ごとの「歩く向き」。中央を0として、左が西向き・右が東向き。
 * 地図と同じ向きに揃えているので、左右がそのまま高知城側・はりまや橋側になる。
 */
export function HourlyDirectionChart({ data }: { data: DemoHourlyDirection[] }) {
  const max = data.reduce((m, row) => Math.max(m, row.west, row.east), 0);
  const plotWidth = CHART_WIDTH - LABEL_WIDTH;
  const center = LABEL_WIDTH + plotWidth / 2;
  const halfWidth = plotWidth / 2 - CENTER_GAP - 22;
  const height = data.length * ROW_HEIGHT + 24;
  const scale = (value: number) => (max > 0 ? (value / max) * halfWidth : 0);

  const peak = data.reduce((best, row) =>
    row.west + row.east > best.west + best.east ? row : best
  );

  return (
    <div>
      <div>
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${height}`}
          className="mx-auto block w-full max-w-[560px]"
          role="img"
          aria-label="時間帯ごとの移動方向"
        >
          <text x={center - 6} y={11} fontSize="11" textAnchor="end" fill={INK.muted}>
            ← 西（高知城側）
          </text>
          <text x={center + 6} y={11} fontSize="11" fill={INK.muted}>
            東（はりまや橋側）→
          </text>

          {data.map((row, index) => {
            const y = 18 + index * ROW_HEIGHT;
            const isPeak = row.hour === peak.hour;
            return (
              <g key={row.hour}>
                <text
                  x={LABEL_WIDTH - 6}
                  y={y + BAR_HEIGHT - 1.5}
                  fontSize="11"
                  textAnchor="end"
                  fill={INK.secondary}
                >
                  {`${row.hour}時`}
                </text>
                <path d={divergingBarPath(center, y, scale(row.west), "left")} fill={DIRECTION.west}>
                  <title>{`${row.hour}時台 西向き ${row.west}`}</title>
                </path>
                <path d={divergingBarPath(center, y, scale(row.east), "right")} fill={DIRECTION.east}>
                  <title>{`${row.hour}時台 東向き ${row.east}`}</title>
                </path>
                {isPeak ? (
                  <>
                    <text
                      x={center - CENTER_GAP - scale(row.west) - 4}
                      y={y + BAR_HEIGHT - 2}
                      fontSize="11"
                      textAnchor="end"
                      fill={INK.secondary}
                    >
                      {row.west}
                    </text>
                    <text
                      x={center + CENTER_GAP + scale(row.east) + 4}
                      y={y + BAR_HEIGHT - 2}
                      fontSize="11"
                      fill={INK.secondary}
                    >
                      {row.east}
                    </text>
                  </>
                ) : null}
              </g>
            );
          })}

          <line
            x1={center}
            y1={15}
            x2={center}
            y2={height - 5}
            stroke={SURFACE.axis}
            strokeWidth="1"
          />
        </svg>
      </div>

      <div className="mt-3">
        <Legend
          items={[
            { color: DIRECTION.west, label: "西向き（高知城側へ）" },
            { color: DIRECTION.east, label: "東向き（はりまや橋側へ）" },
          ]}
        />
      </div>

      <TableView
        columns={["時間帯", "西向き", "東向き", "東向きの割合"]}
        rows={data.map((row) => {
          const total = row.west + row.east;
          return [
            `${row.hour}時台`,
            row.west,
            row.east,
            total > 0 ? `${((row.east / total) * 100).toFixed(1)}%` : "-",
          ];
        })}
        caption="連続するタップの経度差の符号を数えたもの。人数ではなく遷移の回数。"
      />
    </div>
  );
}

// ── 入口・到達率・折り返し地点 ──────────────────────────────────────────

/**
 * 丁目ごとの3つの見方。単位が同じでも意味が違う（入口は合計100%、到達率は違う）ため、
 * 1つのグラフに重ねず、軸を共有しない3枚に分けている。
 */
export function ReachProfile({ rows, turnaround }: { rows: DemoReachRow[]; turnaround: { district: string; share: number }[] }) {
  const maxEntry = rows.reduce((m, row) => Math.max(m, row.entryShare), 0);
  const maxTurn = turnaround.reduce((m, row) => Math.max(m, row.share), 0);

  return (
    <div>
      <div className="grid gap-5 md:grid-cols-3">
        <div>
          <h4 className="text-xs font-bold text-amber-900">入口（最初に触れた丁目）</h4>
          <p className="mt-1 min-h-[2.6rem] text-[11px] leading-snug text-amber-800/75">
            どちらの端から入ってくるか。合計 100%。
          </p>
          <ul className="mt-3 space-y-1.5">
            {rows.map((row) => (
              <BarRow
                key={row.district}
                label={row.district}
                value={row.entryShare}
                max={maxEntry}
                display={`${(row.entryShare * 100).toFixed(1)}%`}
              />
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold text-amber-900">到達率</h4>
          <p className="mt-1 min-h-[2.6rem] text-[11px] leading-snug text-amber-800/75">
            その丁目まで届いた利用者の割合。合計は 100% にならない。
          </p>
          <ul className="mt-3 space-y-1.5">
            {rows.map((row) => (
              <BarRow
                key={row.district}
                label={row.district}
                value={row.reachShare}
                max={1}
                display={`${(row.reachShare * 100).toFixed(1)}%`}
              />
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold text-amber-900">折り返し地点</h4>
          <p className="mt-1 min-h-[2.6rem] text-[11px] leading-snug text-amber-800/75">
            いちばん遠くまで行った丁目。合計 100%。
          </p>
          <ul className="mt-3 space-y-1.5">
            {turnaround.map((row) => (
              <BarRow
                key={row.district}
                label={row.district}
                value={row.share}
                max={maxTurn}
                display={`${(row.share * 100).toFixed(1)}%`}
              />
            ))}
          </ul>
        </div>
      </div>

      <TableView
        columns={["丁目", "入口", "到達率", "折り返し地点"]}
        rows={rows.map((row, index) => [
          row.district,
          `${(row.entryShare * 100).toFixed(1)}%`,
          `${(row.reachShare * 100).toFixed(1)}%`,
          `${((turnaround[index]?.share ?? 0) * 100).toFixed(1)}%`,
        ])}
        caption="丁目は西（六丁目・高知城前）から東（一丁目・はりまや橋側）の順。"
      />
    </div>
  );
}

// ── 開催前の下調べ ──────────────────────────────────────────────────────

export function PreVisitHours({ data }: { data: { label: string; value: number }[] }) {
  const max = data.reduce((m, row) => Math.max(m, row.value), 0);
  return (
    <div>
      <ul className="space-y-1.5">
        {data.map((row) => (
          <BarRow
            key={row.label}
            label={row.label}
            value={row.value}
            max={max}
            display={`${row.value}`}
          />
        ))}
      </ul>
      <TableView
        columns={["時間帯", "利用者数"]}
        rows={data.map((row) => [row.label, row.value])}
      />
    </div>
  );
}
