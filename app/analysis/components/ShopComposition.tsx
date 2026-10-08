import { INK, SERIES, SURFACE, rampStep, inkOn, SEQUENTIAL } from "../chart";
import { ScrollHint, TableView } from "./ui";

export type CategoryCount = { name: string; count: number };

/**
 * カテゴリ別の出店構成。
 *
 * 円グラフから横棒に変えている。カテゴリ名が長く、近い値を見比べる用途なので、
 * 円だと隣り合う扇形の大小が読めない。棒なら共通の基線で比べられる。
 * カテゴリ自体に大小の順序はないので、色は1色に固定する
 * （濃さで量を表すと、棒の長さと同じ情報を色でもう一度描くことになる）。
 */
export function CategoryBars({ data }: { data: CategoryCount[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const max = data.reduce((m, item) => Math.max(m, item.count), 0);

  if (total === 0) {
    return (
      <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 px-4 py-6 text-center text-sm text-amber-800">
        データがまだありません
      </p>
    );
  }

  return (
    <div>
      <ul className="space-y-2">
        {data.map((item) => {
          const ratio = max > 0 ? item.count / max : 0;
          const share = (item.count / total) * 100;
          return (
            <li
              key={item.name}
              className="grid grid-cols-[6.5rem_1fr_5rem] items-center gap-3"
              title={`${item.name}：${item.count}件（${share.toFixed(1)}%）`}
            >
              <span className="truncate text-xs font-medium" style={{ color: INK.secondary }}>
                {item.name}
              </span>
              <span className="block h-4 rounded-sm" style={{ backgroundColor: SURFACE.grid }}>
                <span
                  className="block h-4"
                  style={{
                    width: `${Math.max(ratio * 100, 1.5)}%`,
                    backgroundColor: SERIES.bar,
                    borderRadius: "0 4px 4px 0",
                  }}
                />
              </span>
              <span className="text-right text-xs tabular-nums" style={{ color: INK.secondary }}>
                {item.count}件
                <span className="ml-1 text-[10px] opacity-70">{share.toFixed(1)}%</span>
              </span>
            </li>
          );
        })}
      </ul>

      <TableView
        columns={["カテゴリ", "店舗数", "構成比"]}
        rows={data.map((item) => [
          item.name,
          item.count,
          `${((item.count / total) * 100).toFixed(1)}%`,
        ])}
        caption={`合計 ${total} 件`}
      />
    </div>
  );
}

/**
 * カテゴリ × 丁目のマトリクス。量を1色の濃淡で表す。
 * 濃淡だけで読ませないよう、セルの中に実数も入れている。
 */
export function DistrictMatrix({
  districts,
  rows,
}: {
  districts: readonly string[];
  rows: { category: string; counts: number[] }[];
}) {
  const max = rows.reduce(
    (m, row) => Math.max(m, ...row.counts),
    0
  );

  return (
    <div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[440px] table-fixed border-separate border-spacing-0.5 text-xs">
          <caption className="sr-only">カテゴリ別・丁目別の出店数</caption>
          {/* カテゴリ名と合計の列を固定し、丁目のセルを等幅にする */}
          <colgroup>
            <col style={{ width: "6rem" }} />
            {districts.map((district) => (
              <col key={district} />
            ))}
            <col style={{ width: "2.5rem" }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="px-1 pb-1 text-left font-semibold" style={{ color: INK.secondary }}>
                <span className="sr-only">カテゴリ</span>
              </th>
              {districts.map((district) => (
                <th
                  key={district}
                  scope="col"
                  className="px-1 pb-1 text-center text-[10px] font-semibold"
                  style={{ color: INK.muted }}
                >
                  {district}
                </th>
              ))}
              <th scope="col" className="px-1 pb-1 text-right text-[10px] font-semibold" style={{ color: INK.muted }}>
                計
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const total = row.counts.reduce((sum, value) => sum + value, 0);
              return (
                <tr key={row.category}>
                  <th
                    scope="row"
                    className="whitespace-nowrap px-1 text-left text-[11px] font-medium"
                    style={{ color: INK.secondary }}
                  >
                    {row.category}
                  </th>
                  {row.counts.map((count, index) => {
                    const fill = rampStep(count, max);
                    return (
                      <td
                        key={districts[index]}
                        className="h-7 rounded-sm text-center text-[11px] font-semibold tabular-nums"
                        style={{ backgroundColor: fill, color: inkOn(fill) }}
                        title={`${row.category} × ${districts[index]}：${count}件`}
                      >
                        {count > 0 ? count : ""}
                      </td>
                    );
                  })}
                  <td
                    className="px-1 text-right text-[11px] tabular-nums"
                    style={{ color: INK.secondary }}
                  >
                    {total}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ScrollHint />

      <div className="mt-3 flex items-center gap-2 text-[11px]" style={{ color: INK.secondary }}>
        <span>少ない</span>
        <span className="flex gap-0.5">
          {SEQUENTIAL.map((color) => (
            <span
              key={color}
              aria-hidden="true"
              className="inline-block h-3 w-4 rounded-sm"
              style={{ backgroundColor: color }}
            />
          ))}
        </span>
        <span>多い（最大 {max} 件）</span>
      </div>

      <p className="mt-2 text-[11px]" style={{ color: INK.muted }}>
        左が西（六丁目・高知城前）、右が東（一丁目・はりまや橋側）。
      </p>
    </div>
  );
}
