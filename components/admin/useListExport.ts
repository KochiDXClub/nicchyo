"use client";

import { useCallback, useState } from "react";
import { exportToCSV, exportToJSON, formatDateForFilename } from "@/lib/admin/exportUtils";
import { showToast } from "@/lib/admin/toast";

/**
 * 一覧の CSV / JSON 出力。ファイル名は「<prefix>_日付.csv」。
 * CSV は列名つきの行（toCsvRow）、JSON は行をそのまま出す。
 */
export function useListExport<T>({
  prefix,
  rows,
  toCsvRow,
}: {
  prefix: string;
  rows: readonly T[];
  toCsvRow: (row: T) => Record<string, unknown>;
}) {
  const [isExporting, setIsExporting] = useState(false);

  const run = useCallback(
    (kind: "CSV" | "JSON") => {
      setIsExporting(true);
      try {
        const name = `${prefix}_${formatDateForFilename()}.${kind.toLowerCase()}`;
        const result = kind === "CSV" ? exportToCSV(rows.map(toCsvRow), name) : exportToJSON([...rows], name);
        if (result.success) showToast.success(`${kind}をエクスポートしました`);
        else showToast.error(result.error ?? "エクスポートに失敗しました");
      } catch {
        showToast.error("エクスポートに失敗しました");
      } finally {
        setIsExporting(false);
      }
    },
    [prefix, rows, toCsvRow],
  );

  const exportCsv = useCallback(() => run("CSV"), [run]);
  const exportJson = useCallback(() => run("JSON"), [run]);
  return { isExporting, exportCsv, exportJson };
}
