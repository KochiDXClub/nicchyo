import type { ChomeId } from "./chomes";
import { CHOME_BOUNDARY_TOLERANCE_M, judgeChome, type BoundaryProjection, type ChomeRange } from "./chomeBoundaries";
import { projectOntoRoad, roadLengthMeters } from "./roadSlotPosition";

/**
 * 端末の現在地（GPS）から、いま日曜市のどの丁目にいるかを決める。
 *
 * 緯度経度は、ここで丁目に直したらすぐ捨てる。この関数は丁目（または outside / unknown）だけを返し、
 * 座標をログにも戻り値にも残さない（来場者の位置を送らないための入口）。
 * 道・境目の投影は呼び出し側が buildChomeRanges で 1 回作って渡す（呼び出しのたびに作り直さない）。
 */

type LatLng = { lat: number; lng: number };

/** 丁目 / 日曜市の外 / 判定できない（精度が悪い・境目のすぐ上など） */
export type ChomeArea = ChomeId | "outside" | "unknown";

/**
 * これより悪い精度（m）の GPS は使わない。
 * 街中の端末の GPS は 5〜15m 程度。25m を超えるのは基地局・Wi-Fi 頼みの粗い位置で、丁目の長さ（100〜200m）に対して無視できない。
 */
export const CHOME_MAX_ACCURACY_M = 25;

/**
 * 道の中心線からこの距離（m）より離れていたら日曜市の外とする。
 * 道の線は追手筋の南側車線なので、車道＋歩道＋両側の出店（反対側で 15〜20m ほど）に GPS の誤差を足して 30m。
 */
export const CHOME_MAX_LATERAL_M = 30;

/**
 * 道の端（始点・終点）からこの距離（m）より先に出ていたら外とする。
 * 端に投影されると端の丁目に見えてしまうため。出店 1 区画の奥行きに GPS の誤差を足して 10m。
 */
export const CHOME_MAX_END_OVERSHOOT_M = 10;

const END_EPSILON_M = 1e-6;

export type ChomeFromLocationInput = {
  lat: number;
  lng: number;
  /** 端末が報告する水平精度（m）。取れていなければ null */
  accuracyM: number | null;
};

export type ChomeFromLocationContext = {
  /** 道の id → 道の点（始点 → 終点）。ranges に出てくる道だけが判定の対象になる */
  roads: ReadonlyMap<string, LatLng[]>;
  ranges: readonly ChomeRange[];
  projections: readonly BoundaryProjection[];
};

export type ChomeFromLocationOptions = {
  maxAccuracyM?: number;
  maxLateralM?: number;
  maxEndOvershootM?: number;
  /** 境目の許容（m）の下限。実際の許容は max(これ, 端末の精度)：精度ぶんは境目のどちら側か決められない */
  boundaryToleranceM?: number;
};

export function judgeChomeFromLocation(
  input: ChomeFromLocationInput,
  ctx: ChomeFromLocationContext,
  opts: ChomeFromLocationOptions = {}
): ChomeArea {
  const {
    maxAccuracyM = CHOME_MAX_ACCURACY_M,
    maxLateralM = CHOME_MAX_LATERAL_M,
    maxEndOvershootM = CHOME_MAX_END_OVERSHOOT_M,
    boundaryToleranceM = CHOME_BOUNDARY_TOLERANCE_M,
  } = opts;
  const { lat, lng, accuracyM } = input;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "unknown";
  if (accuracyM == null || !Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > maxAccuracyM) return "unknown";

  // 丁目の区間を持つ道のうち、いちばん近い道に投影する（追手筋と大橋通りが近い交差点付近でも、近いほうを選ぶ）
  let nearest: { roadId: string; distanceM: number; lateralM: number; overshootM: number } | null = null;
  for (const roadId of new Set(ctx.ranges.map((r) => r.roadId))) {
    const points = ctx.roads.get(roadId);
    if (!points) continue;
    const projected = projectOntoRoad(points, { lat, lng });
    if (projected && (!nearest || projected.lateralM < nearest.lateralM)) {
      // 道の端より先に出ている点は、projectOntoRoad が端に丸める。そのとき driftM が出た分にほぼ等しい
      // （道の途中の driftM は折れ曲がりでも出るので、端に丸められたときだけ使う）
      const atEnd = projected.distanceM <= END_EPSILON_M || projected.distanceM >= roadLengthMeters(points) - END_EPSILON_M;
      nearest = { roadId, distanceM: projected.distanceM, lateralM: projected.lateralM, overshootM: atEnd ? projected.driftM : 0 };
    }
  }
  // 道のデータがない（読み込み前など）ときは、外とも言えない
  if (!nearest) return "unknown";

  if (nearest.lateralM > maxLateralM || nearest.overshootM > maxEndOvershootM) return "outside";

  const judgement = judgeChome(
    ctx.ranges,
    ctx.projections,
    { roadId: nearest.roadId, distanceM: nearest.distanceM },
    Math.max(boundaryToleranceM, accuracyM)
  );
  return judgement.status === "ok" ? judgement.chomeId : judgement.status === "outside" ? "outside" : "unknown";
}
