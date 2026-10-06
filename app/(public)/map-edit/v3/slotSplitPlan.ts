import type { RoadSide } from "@/lib/map/roadSlotPosition";

/**
 * 区画分けツールの計算。
 *
 * 出店可の通りの片側（または両側）に、指定した数・間隔で区画を等間隔に並べる。
 * すでにある区画はできるだけ残して位置だけ動かし（店番と出店者がそのまま残る）、
 * 足りない分を新しく作り、多すぎる分は空き区画だけを消す。出店者のいる区画は消さない。
 */

export type SplitSides = "both" | "left" | "right";

export type SlotSplitSettings = {
  mode: "count" | "interval";
  /** 片側あたりの区画数（mode="count"） */
  count: number;
  /** 区画の間隔（m、mode="interval"） */
  intervalM: number;
  sides: SplitSides;
  /** 区画を並べる範囲（道の始点からの距離、m） */
  startM: number;
  endM: number;
};

export type SlotOnRoad = {
  locationId: string;
  side: RoadSide;
  distanceM: number;
  hasVendor: boolean;
};

export type SlotSplitPlan = {
  /** 残して位置だけ動かす区画 */
  moves: Array<{ locationId: string; side: RoadSide; fromM: number; toM: number }>;
  /** そのまま残る区画（位置も変わらない） */
  keeps: Array<{ locationId: string; side: RoadSide; distanceM: number }>;
  /** 新しく作る区画 */
  creates: Array<{ side: RoadSide; distanceM: number }>;
  /** 消す空き区画 */
  deletes: Array<{ locationId: string; side: RoadSide; distanceM: number }>;
  /** 設定どおりにできない理由（あれば適用できない） */
  error: string | null;
};

const SIDE_LABEL: Record<RoadSide, string> = { left: "左側", right: "右側" };
/** 1つでも消す・作るより、位置を動かして残すほうを必ず優先させるための重み */
const ADD_OR_REMOVE_COST = 1e6;
/**
 * 動かしたとみなす最小の距離（m）。設定欄の値は 0.1m 単位に丸めて出すため、
 * 今の並びを再現した設定でも数cmのずれが出る。それを「移動」と数えないようにする
 */
const MOVE_EPSILON_M = 0.1;

export const MAX_SLOTS_PER_SIDE = 200;

export function sidesOf(sides: SplitSides): RoadSide[] {
  return sides === "both" ? ["left", "right"] : [sides];
}

/** 並べる区画の中心位置（道の始点からの距離）。範囲の中に等間隔で並べる */
export function targetDistances(settings: SlotSplitSettings): number[] {
  const span = settings.endM - settings.startM;
  if (!(span > 0)) return [];
  if (settings.mode === "count") {
    const n = Math.max(0, Math.floor(settings.count));
    return Array.from({ length: n }, (_, i) => settings.startM + ((i + 0.5) * span) / n);
  }
  if (!(settings.intervalM > 0)) return [];
  const n = Math.floor(span / settings.intervalM + 1e-9);
  // 余りは両端に半分ずつ振り分けて、範囲の中央に揃える
  const margin = (span - n * settings.intervalM) / 2;
  return Array.from({ length: n }, (_, i) => settings.startM + margin + (i + 0.5) * settings.intervalM);
}

export function validateSplitSettings(settings: SlotSplitSettings, roadLengthM: number): string | null {
  if (!Number.isFinite(settings.startM) || !Number.isFinite(settings.endM)) return "開始位置と終了位置を数字で入れてください。";
  if (settings.startM < 0 || settings.endM > roadLengthM + 0.01) {
    return `開始位置と終了位置は 0〜${Math.floor(roadLengthM)}m の範囲にしてください。`;
  }
  if (settings.endM <= settings.startM) return "終了位置は開始位置より後ろにしてください。";
  if (settings.mode === "count") {
    if (!Number.isInteger(settings.count) || settings.count < 0 || settings.count > MAX_SLOTS_PER_SIDE) {
      return `区画数は 0〜${MAX_SLOTS_PER_SIDE} の整数にしてください。`;
    }
  } else {
    if (!(settings.intervalM >= 1)) return "間隔は 1m 以上にしてください。";
    if (targetDistances(settings).length > MAX_SLOTS_PER_SIDE) {
      return `片側 ${MAX_SLOTS_PER_SIDE} 区画を超えます。間隔を広げてください。`;
    }
  }
  return null;
}

/**
 * 片側ぶんの割り当て。既存の区画（距離順）と並べたい位置（距離順）を、順番を保ったまま
 * 対応づける。消す・作るの数が最小になる組み合わせのうち、動く距離の合計が最小のものを選ぶ。
 * 出店者のいる区画は消さない。そうした組み合わせが無ければ null。
 */
function assignSide(existing: SlotOnRoad[], targets: number[]) {
  const n = existing.length;
  const m = targets.length;
  const INF = Number.POSITIVE_INFINITY;
  // cost[i][j]: 既存の先頭 i 件と、位置の先頭 j 個を処理したときの最小コスト
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(INF));
  const choice: Array<Array<"assign" | "delete" | "create" | null>> = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(null)
  );
  cost[0][0] = 0;
  for (let i = 0; i <= n; i += 1) {
    for (let j = 0; j <= m; j += 1) {
      const current = cost[i][j];
      if (current === INF) continue;
      if (i < n && j < m) {
        const next = current + Math.abs(existing[i].distanceM - targets[j]);
        if (next < cost[i + 1][j + 1]) {
          cost[i + 1][j + 1] = next;
          choice[i + 1][j + 1] = "assign";
        }
      }
      if (i < n && !existing[i].hasVendor) {
        const next = current + ADD_OR_REMOVE_COST;
        if (next < cost[i + 1][j]) {
          cost[i + 1][j] = next;
          choice[i + 1][j] = "delete";
        }
      }
      if (j < m) {
        const next = current + ADD_OR_REMOVE_COST;
        if (next < cost[i][j + 1]) {
          cost[i][j + 1] = next;
          choice[i][j + 1] = "create";
        }
      }
    }
  }
  if (cost[n][m] === INF) return null;

  const assigned: Array<{ slot: SlotOnRoad; toM: number }> = [];
  const deleted: SlotOnRoad[] = [];
  const created: number[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const c = choice[i][j];
    if (c === "assign") {
      assigned.push({ slot: existing[i - 1], toM: targets[j - 1] });
      i -= 1;
      j -= 1;
    } else if (c === "delete") {
      deleted.push(existing[i - 1]);
      i -= 1;
    } else {
      created.push(targets[j - 1]);
      j -= 1;
    }
  }
  return { assigned, deleted, created };
}

export function planRoadSlots(roadLengthM: number, settings: SlotSplitSettings, slotsOnRoad: SlotOnRoad[]): SlotSplitPlan {
  const plan: SlotSplitPlan = { moves: [], keeps: [], creates: [], deletes: [], error: null };
  plan.error = validateSplitSettings(settings, roadLengthM);
  if (plan.error) return plan;

  const targets = targetDistances(settings);
  for (const side of sidesOf(settings.sides)) {
    const existing = slotsOnRoad.filter((slot) => slot.side === side).sort((a, b) => a.distanceM - b.distanceM);
    const result = assignSide(existing, targets);
    if (!result) {
      const vendorCount = existing.filter((slot) => slot.hasVendor).length;
      plan.error = `${SIDE_LABEL[side]}には出店者のいる区画が ${vendorCount} 件あるため、${vendorCount} 区画より少なくできません。先に出店者を空きにするか、別の区画へ移してください。`;
      return { ...plan, moves: [], keeps: [], creates: [], deletes: [] };
    }
    for (const { slot, toM } of result.assigned) {
      if (Math.abs(slot.distanceM - toM) < MOVE_EPSILON_M) {
        plan.keeps.push({ locationId: slot.locationId, side, distanceM: slot.distanceM });
      } else {
        plan.moves.push({ locationId: slot.locationId, side, fromM: slot.distanceM, toM });
      }
    }
    for (const slot of result.deleted) plan.deletes.push({ locationId: slot.locationId, side, distanceM: slot.distanceM });
    for (const distanceM of result.created) plan.creates.push({ side, distanceM });
  }
  plan.creates.sort((a, b) => a.distanceM - b.distanceM);
  return plan;
}

/**
 * 区画分けパネルを開いたときの初期値。今ある区画の並びをそのまま再現する値にする
 * （開いてすぐ「適用」しても区画がほとんど動かないように）。区画が無い道では道全体に10区画。
 */
export function initialSplitSettings(roadLengthM: number, slotsOnRoad: SlotOnRoad[]): SlotSplitSettings {
  const left = slotsOnRoad.filter((slot) => slot.side === "left").length;
  const right = slotsOnRoad.filter((slot) => slot.side === "right").length;
  const length = Math.max(0, Math.floor(roadLengthM * 10) / 10);
  if (slotsOnRoad.length === 0) {
    return { mode: "count", count: 10, intervalM: 6, sides: "both", startM: 0, endM: length };
  }
  const distances = slotsOnRoad.map((slot) => slot.distanceM).sort((a, b) => a - b);
  const count = Math.max(left, right);
  const first = distances[0];
  const last = distances[distances.length - 1];
  const spacing = count > 1 ? (last - first) / (count - 1) : 6;
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    mode: "count",
    count,
    intervalM: round(Math.max(1, spacing)),
    sides: left > 0 && right > 0 ? "both" : left > 0 ? "left" : "right",
    startM: round(Math.max(0, first - spacing / 2)),
    endM: round(Math.min(length, last + spacing / 2)),
  };
}
