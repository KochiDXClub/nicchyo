import { useEffect } from "react";
import type { LaneRoadGroup } from "./components/RoadLaneView";
import type { EditableShop } from "./types";

/**
 * 矢印キー / WASD で、区画レーンと同じ並び順に沿って隣の区画へ移る。
 * ←→ は同じ側の前後、↑↓ は向かい側。検索ボックスなどの入力中は反応しない。
 */
export function useLaneKeyboardNavigation({
  enabled,
  selectedShop,
  shops,
  laneGroups,
  onMove,
}: {
  enabled: boolean;
  selectedShop: EditableShop | null;
  shops: EditableShop[];
  laneGroups: LaneRoadGroup[];
  /** 移動先の区画（選択と地図の移動は呼び出し側で行う） */
  onMove: (shop: EditableShop) => void;
}) {
  useEffect(() => {
    if (!enabled || !selectedShop) return;

    const onKey = (e: KeyboardEvent) => {
      // 検索ボックスなど入力欄にフォーカスがある間は、WASD/矢印キーをナビゲーションとして
      // 横取りしない（例: 「わらび餅」のようにw/a/s/dを含む名前を検索しようとした際に
      // 文字入力が握りつぶされて区画移動してしまうのを防ぐ）
      const eventTarget = e.target;
      const isFormField =
        eventTarget instanceof HTMLElement &&
        (eventTarget.tagName === "INPUT" ||
          eventTarget.tagName === "TEXTAREA" ||
          eventTarget.tagName === "SELECT" ||
          eventTarget.isContentEditable);
      if (isFormField) return;
      // Ctrl+Z などのショートカットの z/s/d/w/a を区画移動として拾わない
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const lower = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const isLeft = e.key === "ArrowLeft" || lower === "a";
      const isRight = e.key === "ArrowRight" || lower === "d";
      const isUp = e.key === "ArrowUp" || lower === "w";
      const isDown = e.key === "ArrowDown" || lower === "s";
      if (!isLeft && !isRight && !isUp && !isDown) return;

      // レーン表示（road → 丁目 → 北側/南側の対カラム）を左から右へ1列に平らにし、
      // 表示と全く同じ並び順で移動先を探す（店番の大小に依存すると、実際の並びと
      // 逆方向に動くことがあるため位置番号の算術には頼らない）
      const columns: { north?: EditableShop; south?: EditableShop }[] = [];
      for (const { sections } of laneGroups) {
        for (const section of sections) {
          for (let i = 0; i < section.columns; i += 1) {
            columns.push({ north: section.north[i]?.shop, south: section.south[i]?.shop });
          }
        }
      }

      const currentIndex = columns.findIndex(
        (col) => col.north?.locationId === selectedShop.locationId || col.south?.locationId === selectedShop.locationId
      );

      if (currentIndex === -1) {
        // market種別の道に紐づくレーンに含まれない区画（他種別の道が最寄りだったり、
        // どの道からも離れすぎている場合）は、旧実装と同じ店番の前後関係で移動する
        // フォールバックを使う（レーンに存在しないせいで一切動かせなくなるのを防ぐ）
        const n = selectedShop.position;
        let nextPos: number | null = null;
        if (isRight) nextPos = n + 2;
        else if (isLeft) nextPos = n - 2;
        else if (isUp || isDown) nextPos = n % 2 === 1 ? n + 1 : n - 1;
        if (nextPos != null) {
          const fallbackTarget = shops.find((s) => s.position === nextPos);
          if (fallbackTarget) {
            e.preventDefault();
            onMove(fallbackTarget);
          }
        }
        return;
      }

      const currentSide: "north" | "south" =
        columns[currentIndex].north?.locationId === selectedShop.locationId ? "north" : "south";

      let targetIndex = currentIndex;
      let targetSide = currentSide;
      if (isRight) {
        let i = currentIndex + 1;
        while (i < columns.length && !columns[i][currentSide]) i += 1;
        if (i < columns.length) targetIndex = i;
      } else if (isLeft) {
        let i = currentIndex - 1;
        while (i >= 0 && !columns[i][currentSide]) i -= 1;
        if (i >= 0) targetIndex = i;
      } else if (isUp) {
        targetSide = "north";
      } else if (isDown) {
        targetSide = "south";
      }

      const target = columns[targetIndex]?.[targetSide];
      if (target) {
        e.preventDefault();
        onMove(target);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, selectedShop, shops, laneGroups, onMove]);
}
