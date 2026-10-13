"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Tooltip } from "./desktop/Tooltip";
import { SortableColumnHeader, type SortDirection } from "./desktop/SortableTableHeader";
import type { RowSelection } from "./useRowSelection";
import { cn } from "@/lib/utils/cn";

export interface DataColumn<T> {
  key: string;
  header: string;
  /** 付けると見出しを押して並べ替えられる（useSortableData の sortKey と同じ名前） */
  sortKey?: string;
  /** セルの横幅や折り返しなど（th と td の両方に付く） */
  className?: string;
  render: (row: T, index: number) => React.ReactNode;
}

interface AdminDataTableProps<T> {
  /** 並べ替え・絞り込みが済んだ、いま見せる行 */
  rows: readonly T[];
  getRowId: (row: T) => string;
  columns: readonly DataColumn<T>[];
  sort?: { key: string | null; direction: SortDirection; onSort: (key: string) => void };
  /** 付けると先頭にチェックボックスの列が付く（useRowSelection の戻り値） */
  selection?: RowSelection;
  /** チェックボックスの読み上げ名（例: 店舗「○○」を選択） */
  selectionLabel?: (row: T) => string;
  selectAllLabel?: string;
  /** 最後の「操作」列に置くボタンなど */
  actions?: (row: T) => React.ReactNode;
  /** 付けると、スマホ幅では表の代わりにこのカードを縦に並べる。無ければスマホでも表（横にスクロール） */
  mobileCard?: (row: T, index: number) => React.ReactNode;
  /**
   * 行が多いときだけ。表示している行だけ描く（上下の余白は空の行で埋めるので、表の構造は変わらない）。
   * スクロールで列幅が揺れないよう table-fixed にするので、各列の className に幅（w-32 など）を付ける。
   */
  virtualize?: boolean;
  /** 表の高さの上限（スクロールする） */
  maxHeightClass?: string;
}

const ESTIMATED_ROW_HEIGHT = 64;

/**
 * 管理画面の一覧表。店舗管理・ユーザー管理で共通。
 * 本物の <table> を使い、見出しは上に貼りつく。仮想スクロールでも <table> の構造は崩さない
 * （行を絶対配置にしたり、tbody に div を入れたりしない。それで列がずれていた）。
 */
export function AdminDataTable<T>({
  rows,
  getRowId,
  columns,
  sort,
  selection,
  selectionLabel,
  selectAllLabel = "表示中の行をすべて選択",
  actions,
  mobileCard,
  virtualize = false,
  maxHeightClass = "max-h-[70vh]",
}: AdminDataTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8,
    enabled: virtualize,
  });

  const virtualItems = virtualize ? virtualizer.getVirtualItems() : null;
  const visible: { row: T; index: number }[] = virtualItems
    ? virtualItems.map((v) => ({ row: rows[v.index], index: v.index }))
    : rows.map((row, index) => ({ row, index }));
  const spaceTop = virtualItems && virtualItems.length > 0 ? virtualItems[0].start : 0;
  const spaceBottom =
    virtualItems && virtualItems.length > 0 ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end : 0;
  const columnCount = columns.length + (selection ? 1 : 0) + (actions ? 1 : 0);

  return (
    <>
      <div
        className={cn(
          "overflow-hidden rounded-card bg-white shadow-card ring-1 ring-line",
          mobileCard && "hidden sm:block"
        )}
      >
        <div ref={scrollRef} className={cn("overflow-auto", maxHeightClass)}>
          <table className={cn("w-full", virtualize ? "min-w-[960px] table-fixed" : "min-w-[720px]")}>
            <thead className="sticky top-0 z-10 bg-nicchyo-base">
              <tr className="border-b border-line">
                {selection && (
                  <th scope="col" className="w-10 px-4 py-3 text-left">
                    <Tooltip content="全選択/解除 (Ctrl+A)" position="top">
                      <input
                        type="checkbox"
                        aria-label={selectAllLabel}
                        checked={selection.allSelected}
                        onChange={selection.toggleAll}
                        className="h-4 w-4 rounded border-line accent-amber-600"
                      />
                    </Tooltip>
                  </th>
                )}
                {columns.map((col) =>
                  col.sortKey && sort ? (
                    <SortableColumnHeader
                      key={col.key}
                      label={col.header}
                      sortKey={col.sortKey}
                      currentSortKey={sort.key}
                      currentSortDirection={sort.direction}
                      onSort={sort.onSort}
                      className={col.className}
                    />
                  ) : (
                    <th key={col.key} scope="col" className={cn("px-4 py-3 text-left text-xs font-medium text-nicchyo-ink/55", col.className)}>
                      {col.header}
                    </th>
                  )
                )}
                {actions && (
                  <th scope="col" className={cn("px-4 py-3 text-right text-xs font-medium text-nicchyo-ink/55", virtualize && "w-56")}>
                    操作
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {spaceTop > 0 && (
                <tr aria-hidden="true" style={{ height: spaceTop }}>
                  <td colSpan={columnCount} className="p-0" />
                </tr>
              )}
              {visible.map(({ row, index }) => {
                const id = getRowId(row);
                return (
                  <tr key={id} className="hover:bg-nicchyo-base/60">
                    {selection && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={selectionLabel?.(row) ?? "この行を選択"}
                          checked={selection.isSelected(id)}
                          onChange={(e) => selection.toggle(id, index, (e.nativeEvent as MouseEvent).shiftKey)}
                          className="h-4 w-4 rounded border-line accent-amber-600"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-4 py-3 text-sm text-nicchyo-ink/70", col.className)}>
                        {col.render(row, index)}
                      </td>
                    ))}
                    {actions && (
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">{actions(row)}</div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {spaceBottom > 0 && (
                <tr aria-hidden="true" style={{ height: spaceBottom }}>
                  <td colSpan={columnCount} className="p-0" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {mobileCard && (
        <ul className="space-y-3 sm:hidden">
          {rows.map((row, index) => (
            <li key={getRowId(row)}>{mobileCard(row, index)}</li>
          ))}
        </ul>
      )}
    </>
  );
}
