import { useMemo } from "react";
import {
  buildChomeRanges,
  judgeChome,
  type ChomeBoundary,
  type ChomeJudgement,
  type ChomeSection,
} from "@/lib/map/chomeBoundaries";
import type { EditableRoad } from "./types";

export type JudgeChome = (roadId: string, distanceM: number) => ChomeJudgement;

/**
 * 区画の道上の位置から丁目を判定する関数。境目の位置は、いまの道の形（編集中の道を含む）に
 * 投影して決めるので、道の点を動かすと区間も追従する。境目・区間が無い（マイグレーション前）あいだは
 * どの区画も「対象外」になり、呼び出し側が従来の決め方に戻る。
 */
export function useChomeJudge(
  roads: EditableRoad[],
  boundaries: ChomeBoundary[],
  sections: ChomeSection[]
): { judge: JudgeChome; problems: string[] } {
  return useMemo(() => {
    const roadPoints = new Map(roads.map((road) => [road.id, road.points.map((p) => ({ lat: p.lat, lng: p.lng }))]));
    const { ranges, projections, problems } = buildChomeRanges(roadPoints, boundaries, sections);
    return {
      judge: (roadId, distanceM) => judgeChome(ranges, projections, { roadId, distanceM }),
      problems,
    };
  }, [roads, boundaries, sections]);
}
