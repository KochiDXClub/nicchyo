import React from "react";

export type SortDirection = "asc" | "desc" | null;

interface SortableColumnHeaderProps {
  label: string;
  sortKey: string;
  currentSortKey: string | null;
  currentSortDirection: SortDirection;
  onSort: (key: string) => void;
  className?: string;
}

/**
 * 本物の <table> の <th> に置くソート見出し。
 */
export const SortableColumnHeader = React.memo(function SortableColumnHeader({
  label,
  sortKey,
  currentSortKey,
  currentSortDirection,
  onSort,
  className = "",
}: SortableColumnHeaderProps) {
  const isActive = currentSortKey === sortKey;
  const arrow = !isActive ? "" : currentSortDirection === "asc" ? "▲" : "▼";
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-left text-xs font-medium text-nicchyo-ink/55 ${className}`}
      aria-sort={isActive ? (currentSortDirection === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-nicchyo-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
      >
        {label}
        <span aria-hidden="true" className="text-[10px] text-amber-700">{arrow}</span>
      </button>
    </th>
  );
});

export function useSortableData<T>(data: T[], defaultSortKey?: keyof T) {
  const [sortKey, setSortKey] = React.useState<string | null>(defaultSortKey?.toString() || null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");

  const handleSort = React.useCallback((key: string) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        return key;
      } else {
        setSortDirection("asc");
        return key;
      }
    });
  }, []);

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aValue = (a as Record<string, unknown>)[sortKey];
      const bValue = (b as Record<string, unknown>)[sortKey];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      const aString = String(aValue).toLowerCase();
      const bString = String(bValue).toLowerCase();

      if (sortDirection === "asc") {
        return aString < bString ? -1 : aString > bString ? 1 : 0;
      } else {
        return aString > bString ? -1 : aString < bString ? 1 : 0;
      }
    });
  }, [data, sortKey, sortDirection]);

  return {
    sortedData,
    sortKey,
    sortDirection,
    handleSort,
  };
}
