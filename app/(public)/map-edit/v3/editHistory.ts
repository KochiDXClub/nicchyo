import { getRouteCenter } from "../../map/utils/mapRouteGeometry";
import type { EditableLandmark, EditableRoad, EditableShop } from "./types";

/**
 * マップ編集の「操作」の記録。
 *
 * 編集操作はすべて「変更前の状態 → 変更後の状態」の組として1件の操作に記録し、
 * 変更一覧・取り消し・やり直し・保存時の差分をこの同じ記録から作る
 * （別々に持つと、一覧には出ないのに保存される変更や、取り消せない変更が生まれるため）。
 *
 * 状態全体を複製して持つのではなく、変わった要素（区画・道・建物）だけを
 * 前後の値として持つ。
 */

export type EditState = {
  shops: EditableShop[];
  roads: EditableRoad[];
  landmarks: EditableLandmark[];
};

export type EntityKind = keyof EditState;

type EntityOf<K extends EntityKind> = EditState[K][number];

/**
 * 1つの要素の変化。before/after が null のときは「その時点で存在しない」を表す
 * （before=null は新規追加、after=null は削除）。
 * index は配列内の位置で、取り消し・やり直しで元の並び順に戻すために使う
 * （道の並び順は保存される点の順序にも影響するため）。
 */
export type EntityChange<K extends EntityKind = EntityKind> = {
  kind: K;
  id: string;
  before: EntityOf<K> | null;
  after: EntityOf<K> | null;
  beforeIndex: number;
  afterIndex: number;
};

export type EditOperation = {
  id: number;
  label: string;
  text: string;
  changes: EntityChange[];
  /** 同じキーの操作が続いたら1件にまとめる（名前の入力など、1文字ごとに記録しないため） */
  coalesceKey?: string;
  recordedAt: number;
};

export type EditHistory = {
  /** 古い順 */
  past: EditOperation[];
  /** 取り消した操作。やり直す順（次にやり直すものが末尾） */
  future: EditOperation[];
};

export const EMPTY_HISTORY: EditHistory = { past: [], future: [] };

/** 同じ coalesceKey の操作をまとめる時間（ミリ秒） */
export const COALESCE_WINDOW_MS = 1500;

const ENTITY_KINDS: EntityKind[] = ["shops", "roads", "landmarks"];

export function entityId(kind: EntityKind, entity: EntityOf<EntityKind>): string {
  if (kind === "shops") return (entity as EditableShop).locationId;
  if (kind === "roads") return (entity as EditableRoad).id;
  return (entity as EditableLandmark).key;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 2つの状態を比べ、変わった要素だけを取り出す */
export function diffStates(before: EditState, after: EditState): EntityChange[] {
  const changes: EntityChange[] = [];
  for (const kind of ENTITY_KINDS) {
    const beforeList = before[kind] as EntityOf<EntityKind>[];
    const afterList = after[kind] as EntityOf<EntityKind>[];
    if (beforeList === afterList) continue;

    const beforeById = new Map(beforeList.map((entity, index) => [entityId(kind, entity), { entity, index }]));
    const afterById = new Map(afterList.map((entity, index) => [entityId(kind, entity), { entity, index }]));

    for (const [id, b] of beforeById) {
      const a = afterById.get(id);
      if (!a) {
        changes.push({ kind, id, before: b.entity, after: null, beforeIndex: b.index, afterIndex: -1 });
      } else if (!sameValue(b.entity, a.entity)) {
        changes.push({ kind, id, before: b.entity, after: a.entity, beforeIndex: b.index, afterIndex: a.index });
      }
    }
    for (const [id, a] of afterById) {
      if (!beforeById.has(id)) {
        changes.push({ kind, id, before: null, after: a.entity, beforeIndex: -1, afterIndex: a.index });
      }
    }
  }
  return changes;
}

/**
 * 変化を状態へ当てはめる。direction="redo" は after へ、"undo" は before へ戻す。
 * 追加・削除された要素は記録した位置（index）に差し戻す。
 */
export function applyChanges(state: EditState, changes: EntityChange[], direction: "undo" | "redo"): EditState {
  const next: EditState = { ...state };
  for (const kind of ENTITY_KINDS) {
    const kindChanges = changes.filter((change) => change.kind === kind);
    if (kindChanges.length === 0) continue;

    const targetOf = (change: EntityChange) => (direction === "redo" ? change.after : change.before);
    const indexOf = (change: EntityChange) => (direction === "redo" ? change.afterIndex : change.beforeIndex);
    const changedIds = new Set(kindChanges.map((change) => change.id));

    // 変わった要素をいったん全部外し、残った要素の並びに、戻す値を元の位置で差し込む
    const list = (state[kind] as EntityOf<EntityKind>[]).filter((entity) => !changedIds.has(entityId(kind, entity)));
    const inserts = kindChanges
      .filter((change) => targetOf(change) !== null)
      .sort((a, b) => indexOf(a) - indexOf(b));
    for (const change of inserts) {
      const index = Math.min(Math.max(indexOf(change), 0), list.length);
      list.splice(index, 0, targetOf(change) as EntityOf<EntityKind>);
    }
    (next as Record<EntityKind, unknown>)[kind] = list;
  }
  return next;
}

/**
 * 操作を記録する。変化がなければ記録しない。
 * 直前の操作と coalesceKey が同じで時間が近ければ、1件にまとめる。
 * 新しい操作を記録したら、やり直し用の記録は捨てる。
 */
export function recordOperation(
  history: EditHistory,
  operation: Omit<EditOperation, "changes"> & { before: EditState; after: EditState }
): EditHistory {
  const { before, after, ...rest } = operation;
  const last = history.past[history.past.length - 1];
  const canCoalesce =
    !!operation.coalesceKey &&
    !!last &&
    history.future.length === 0 &&
    last.coalesceKey === operation.coalesceKey &&
    operation.recordedAt - last.recordedAt <= COALESCE_WINDOW_MS;

  if (canCoalesce) {
    // まとめる場合は「まとめた最初の操作の前」から「今回の後」までを1件にする
    const merged = mergeChanges([...last.changes, ...diffStates(before, after)]);
    const past = history.past.slice(0, -1);
    if (merged.length === 0) return { past, future: [] };
    return {
      past: [...past, { ...last, ...rest, id: last.id, changes: merged }],
      future: [],
    };
  }

  const changes = diffStates(before, after);
  if (changes.length === 0) return history;
  return { past: [...history.past, { ...rest, changes }], future: [] };
}

export function undoOperation(history: EditHistory, state: EditState): { history: EditHistory; state: EditState } | null {
  const last = history.past[history.past.length - 1];
  if (!last) return null;
  return {
    history: { past: history.past.slice(0, -1), future: [...history.future, last] },
    state: applyChanges(state, last.changes, "undo"),
  };
}

export function redoOperation(history: EditHistory, state: EditState): { history: EditHistory; state: EditState } | null {
  const next = history.future[history.future.length - 1];
  if (!next) return null;
  return {
    history: { past: [...history.past, next], future: history.future.slice(0, -1) },
    state: applyChanges(state, next.changes, "redo"),
  };
}

/**
 * 変化の列を、要素ごとに「最初の before → 最後の after」の1件へたたむ。
 * 行って戻っただけの要素（最初と最後が同じ）は除く。
 */
export function mergeChanges(changes: EntityChange[]): EntityChange[] {
  const byKey = new Map<string, EntityChange>();
  for (const change of changes) {
    const key = `${change.kind}:${change.id}`;
    const existing = byKey.get(key);
    byKey.set(
      key,
      existing
        ? { ...existing, after: change.after, afterIndex: change.afterIndex }
        : change
    );
  }
  return [...byKey.values()].filter(
    (change) => !(change.before === null && change.after === null) && !sameValue(change.before, change.after)
  );
}

/** 保存していない変化（記録済みの操作すべてをたたんだもの）。保存時の差分と未保存の判定に使う */
export function netChanges(history: EditHistory): EntityChange[] {
  return mergeChanges(history.past.flatMap((operation) => operation.changes));
}

/** 変更一覧の行をクリックしたときに地図を寄せる位置 */
export function focusOfOperation(operation: EditOperation): { lat: number; lng: number } | null {
  for (const change of operation.changes) {
    const entity = change.after ?? change.before;
    if (!entity) continue;
    if (change.kind === "roads") {
      const road = entity as EditableRoad;
      if (road.points.length === 0) continue;
      const [lat, lng] = getRouteCenter(road.points);
      return { lat, lng };
    }
    const { lat, lng } = entity as EditableShop | EditableLandmark;
    return { lat, lng };
  }
  return null;
}
