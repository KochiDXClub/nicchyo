import { MARKET_STATUS, SURFACE, INK, inkOn, type MarketStatus } from "../chart";
import { Legend, ScrollHint, TableView } from "./ui";

export type MarketDayPoint = { date: string; status: MarketStatus };

const CELL = 11;
const GAP = 2;
const PITCH = CELL + GAP;
const LABEL_WIDTH = 42;
const RATIO_WIDTH = 74;
const ROW_HEIGHT = 22;
const HEADER_HEIGHT = 18;
const MAX_WEEKS = 53;

const STATUS_ORDER: MarketStatus[] = ["open", "cancelled", "special", "closed"];

function formatJapaneseDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

/**
 * 開催実績カレンダー。1行が1年、1セルが1回の日曜。
 *
 * 色だけでは荒天中止を見分けられない人がいるため、開催以外のセルには記号を重ねている
 * （× 荒天中止 / ★ 特別開催 / － 臨時休市）。凡例と表形式の代替表示も必ず併記する。
 */
export default function MarketDaysHeatmap({ days }: { days: MarketDayPoint[] }) {
  const byYear = new Map<string, MarketDayPoint[]>();
  days.forEach((day) => {
    const year = day.date.slice(0, 4);
    const list = byYear.get(year);
    if (list) list.push(day);
    else byYear.set(year, [day]);
  });

  const years = Array.from(byYear.keys()).sort();
  const width = LABEL_WIDTH + MAX_WEEKS * PITCH + RATIO_WIDTH;
  const height = HEADER_HEIGHT + years.length * ROW_HEIGHT + 4;

  // 上端の月ラベル。四半期の頭だけに絞って、目盛りが賑やかになりすぎないようにする。
  // 途中までの年を基準にすると後半のラベルが落ちるので、いちばん行が埋まっている年を使う。
  const referenceYear = years.reduce(
    (best, year) => ((byYear.get(year)?.length ?? 0) > (byYear.get(best)?.length ?? 0) ? year : best),
    years[0] ?? ""
  );
  const reference = byYear.get(referenceYear) ?? [];
  const monthTicks: { x: number; label: string }[] = [];
  reference.forEach((day, index) => {
    const month = Number(day.date.slice(5, 7));
    const previousMonth = index === 0 ? 0 : Number(reference[index - 1].date.slice(5, 7));
    if (month !== previousMonth && [1, 4, 7, 10].includes(month)) {
      monthTicks.push({ x: LABEL_WIDTH + index * PITCH, label: `${month}月` });
    }
  });

  const tableRows = years.map((year) => {
    const list = byYear.get(year) ?? [];
    const counts = STATUS_ORDER.map(
      (status) => list.filter((day) => day.status === status).length
    );
    const held = list.length - counts[1];
    const cancelRate = list.length > 0 ? (counts[1] / list.length) * 100 : 0;
    return [`${year}年`, list.length, held, counts[1], counts[2], counts[3], `${cancelRate.toFixed(1)}%`];
  });

  return (
    <div>
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ minWidth: `${width}px` }}
          role="img"
          aria-label="年ごとの日曜市の開催実績カレンダー"
        >
          {monthTicks.map((tick) => (
            <text
              key={tick.label}
              x={tick.x}
              y={HEADER_HEIGHT - 6}
              fontSize="9"
              fill={INK.muted}
            >
              {tick.label}
            </text>
          ))}

          {years.map((year, rowIndex) => {
            const list = byYear.get(year) ?? [];
            const cancelled = list.filter((day) => day.status === "cancelled").length;
            const cancelRate = list.length > 0 ? (cancelled / list.length) * 100 : 0;
            const y = HEADER_HEIGHT + rowIndex * ROW_HEIGHT;
            return (
              <g key={year}>
                <text
                  x={0}
                  y={y + CELL - 1}
                  fontSize="10"
                  fill={INK.secondary}
                  fontWeight="600"
                >
                  {year}
                </text>

                {Array.from({ length: MAX_WEEKS }).map((_, weekIndex) => {
                  const day = list[weekIndex];
                  const x = LABEL_WIDTH + weekIndex * PITCH;
                  if (!day) {
                    return (
                      <rect
                        key={`${year}-${weekIndex}`}
                        x={x}
                        y={y}
                        width={CELL}
                        height={CELL}
                        rx={2}
                        fill={SURFACE.empty}
                      />
                    );
                  }
                  const status = MARKET_STATUS[day.status];
                  return (
                    <g key={`${year}-${weekIndex}`}>
                      <rect x={x} y={y} width={CELL} height={CELL} rx={2} fill={status.color}>
                        <title>{`${formatJapaneseDate(day.date)}：${status.label}`}</title>
                      </rect>
                      {status.glyph ? (
                        <text
                          x={x + CELL / 2}
                          y={y + CELL - 2.5}
                          fontSize="8"
                          fontWeight="700"
                          textAnchor="middle"
                          fill={inkOn(status.color)}
                          pointerEvents="none"
                        >
                          {status.glyph}
                        </text>
                      ) : null}
                    </g>
                  );
                })}

                <text
                  x={LABEL_WIDTH + MAX_WEEKS * PITCH + 8}
                  y={y + CELL - 1}
                  fontSize="10"
                  fill={INK.muted}
                >
                  {`中止 ${cancelRate.toFixed(1)}%`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <ScrollHint />

      <div className="mt-3">
        <Legend
          items={STATUS_ORDER.map((status) => ({
            color: MARKET_STATUS[status].color,
            label: MARKET_STATUS[status].label,
            glyph: MARKET_STATUS[status].glyph,
          }))}
        />
      </div>

      <TableView
        columns={["年", "日曜の回数", "開催", "荒天中止", "特別開催", "臨時休市", "中止率"]}
        rows={tableRows}
      />
    </div>
  );
}
