"use client";

import { useCallback, useMemo, useRef, useState } from "react";

/**
 * 一覧の行の選択（チェックボックス）。店舗管理・ユーザー管理など、一括操作のある一覧で共通。
 * ids は「いま画面に並んでいる順」の id。Shift を押しながら選ぶと、前に選んだ行との間をまとめて選ぶ。
 * 絞り込みや検索で見えなくなった行は、選択からも外れる（見えていない行に一括操作が及ばないように）。
 */
export function useRowSelection(ids: readonly string[]) {
  const [picked, setPicked] = useState<string[]>([]);
  const lastId = useRef<string | null>(null);
  const idSet = useMemo(() => new Set(ids), [ids]);
  const selectedIds = useMemo(() => picked.filter((id) => idSet.has(id)), [picked, idSet]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedSet.has(id));

  const isSelected = useCallback((id: string) => selectedSet.has(id), [selectedSet]);

  const toggle = useCallback(
    (id: string, index: number, shiftKey = false) => {
      const last = lastId.current === null ? -1 : ids.indexOf(lastId.current);
      if (shiftKey && last >= 0) {
        const range = ids.slice(Math.min(last, index), Math.max(last, index) + 1);
        setPicked((prev) => Array.from(new Set([...prev.filter((x) => idSet.has(x)), ...range])));
        return;
      }
      setPicked((prev) => {
        const current = prev.filter((x) => idSet.has(x));
        return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      });
      lastId.current = id;
    },
    [ids, idSet],
  );

  const toggleAll = useCallback(() => {
    setPicked(allSelected ? [] : [...ids]);
  }, [allSelected, ids]);

  const clear = useCallback(() => {
    setPicked([]);
    lastId.current = null;
  }, []);

  return { selectedIds, isSelected, toggle, toggleAll, clear, allSelected };
}

export type RowSelection = ReturnType<typeof useRowSelection>;
