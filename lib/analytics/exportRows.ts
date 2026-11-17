/** 取得結果を途中で切り捨てず、上限を超える場合は失敗として扱う。 */
export async function readAllExportRows<T>(fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>, pageSize = 500, maxRows = 50000): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from <= maxRows; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error || !data) throw new Error("データを取得できませんでした");
    rows.push(...data);
    if (rows.length > maxRows) throw new Error("対象件数が上限を超えました。期間を短くしてください");
    if (data.length < pageSize) return rows;
  }
  throw new Error("対象件数が上限を超えました。期間を短くしてください");
}

/** 自由記述や閲覧者識別子を集計 CSV に含めない。 */
export function aggregateExportRows(rows: Record<string, unknown>[], dateColumn: string, dimensionColumn?: string): Record<string, unknown>[] {
  const counts = new Map<string, { date: string; category: string; count: number }>();
  for (const row of rows) {
    const value = row[dateColumn];
    const parsed = typeof value === "string" && value.length > 10 ? new Date(value) : null;
    const date = parsed && !Number.isNaN(parsed.getTime())
      ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed)
      : String(value ?? "").slice(0, 10);
    const category = dimensionColumn ? String(row[dimensionColumn] ?? "未設定").split("?")[0] : "";
    const key = JSON.stringify([date, category]);
    const entry = counts.get(key) ?? { date, category, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.date.localeCompare(a.date) || a.category.localeCompare(b.category));
}
