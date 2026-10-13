"use client";

import { useCallback, useMemo, useRef, useState } from "react";

/**
 * 一覧の行の選択（チェックボックス）。店舗管理・ユーザー管理など、一括操作のある一覧で共通。
 * ids は「いま画面に並んでいる順」の id。Shift を押しながら選ぶと、前に選んだ行との間をまとめて選ぶ。
 */
export function useRowSelection(ids: readonly string[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const lastIndex = useRef<number | null>(null);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedSet.has(id));

  const isSelected = useCallback((id: string) => selectedSet.has(id), [selectedSet]);

  const toggle = useCallback(
    (id: string, index: number, shiftKey = false) => {
      if (shiftKey && lastIndex.current !== null) {
        const start = Math.min(lastIndex.current, index);
        const end = Math.max(lastIndex.current, index);
        const range = ids.slice(start, end + 1);
        setSelectedIds((prev) => Array.from(new Set([...prev, ...range])));
        return;
      }
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      lastIndex.current = index;
    },
    [ids],
  );

  const toggleAll = useCallback(() => {
    setSelectedIds(allSelected ? [] : [...ids]);
  }, [allSelected, ids]);

  const clear = useCallback(() => {
    setSelectedIds([]);
    lastIndex.current = null;
  }, []);

  return { selectedIds, isSelected, toggle, toggleAll, clear, allSelected };
}

export type RowSelection = ReturnType<typeof useRowSelection>;
