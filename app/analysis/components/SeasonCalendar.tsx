import { INK, SEQUENTIAL, SURFACE } from "../chart";
import { Legend, ScrollHint, TableView } from "./ui";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const LEVEL = {
  0: { color: SURFACE.empty, glyph: "", label: "出回らない" },
  1: { color: SEQUENTIAL[1], glyph: "", label: "出回る" },
  2: { color: SEQUENTIAL[5], glyph: "●", label: "旬" },
} as const;

/**
 * 旬カレンダー。行が品目、列が月。
 * 濃さだけで「旬」を判断させないよう、旬のセルには記号を重ねている。
 */
export default function SeasonCalendar({
  rows,
  currentMonth,
}: {
  rows: { product: string; months: number[] }[];
  currentMonth: number;
}) {
  return (
    <div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[460px] table-fixed border-separate border-spacing-0.5 text-xs">
          <caption className="sr-only">品目ごとの月別の出回り</caption>
          {/* 品目名の列に余りを吸わせないよう幅を固定し、12か月を等幅にする */}
          <colgroup>
            <col style={{ width: "5.5rem" }} />
            {MONTHS.map((month) => (
              <col key={month} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="px-1 pb-1 text-left">
                <span className="sr-only">品目</span>
              </th>
              {MONTHS.map((month) => (
                <th
                  key={month}
                  scope="col"
                  className="px-0.5 pb-1 text-center text-[10px] font-semibold"
                  style={{ color: month === currentMonth ? INK.primary : INK.muted }}
                >
                  {month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.product}>
                <th
                  scope="row"
                  className="whitespace-nowrap px-1 text-left text-[11px] font-medium"
                  style={{ color: INK.secondary }}
                >
                  {row.product}
                </th>
                {row.months.map((level, index) => {
                  const spec = LEVEL[(level as 0 | 1 | 2) ?? 0] ?? LEVEL[0];
                  const month = MONTHS[index];
                  return (
                    <td
                      key={month}
                      className="h-7 rounded-sm text-center text-[9px] font-bold leading-none"
                      style={{
                        backgroundColor: spec.color,
                        color: "#ffffff",
                        outline: month === currentMonth ? `1px solid ${INK.muted}` : undefined,
                      }}
                      title={`${row.product}・${month}月：${spec.label}`}
                    >
                      <span aria-hidden="true">{spec.glyph}</span>
                      <span className="sr-only">{spec.label}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ScrollHint />

      <div className="mt-3">
        <Legend
          items={[
            { color: LEVEL[2].color, label: "旬", glyph: "●" },
            { color: LEVEL[1].color, label: "出回る" },
            { color: LEVEL[0].color, label: "出回らない" },
          ]}
        />
      </div>

      <TableView
        columns={["品目", "旬の月", "出回る月"]}
        rows={rows.map((row) => [
          row.product,
          row.months
            .map((level, index) => (level === 2 ? `${MONTHS[index]}月` : null))
            .filter(Boolean)
            .join("・") || "-",
          row.months
            .map((level, index) => (level === 1 ? `${MONTHS[index]}月` : null))
            .filter(Boolean)
            .join("・") || "-",
        ])}
      />
    </div>
  );
}
