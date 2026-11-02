import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MapCamera, MapCameraEvent } from "../types/mapCamera";
import {
  PAN_END_FALLBACK_MS,
  PAN_SETTLE_DELAY_MS,
  hideWhilePanningClass,
  useMapPanning,
} from "./useMapPanning";

type Handler = (...args: unknown[]) => void;

/** on/off だけを本物らしく持つ偽のカメラ。emit でイベントを起こす */
function createFakeCamera() {
  const handlers = new Map<MapCameraEvent, Set<Handler>>();
  const camera = {
    on: vi.fn((event: MapCameraEvent, handler: Handler) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    }),
    off: vi.fn((event: MapCameraEvent, handler: Handler) => {
      handlers.get(event)?.delete(handler);
    }),
  } as unknown as MapCamera;
  const emit = (event: MapCameraEvent) => {
    act(() => {
      for (const handler of handlers.get(event) ?? []) handler();
    });
  };
  const listenerCount = () => [...handlers.values()].reduce((sum, set) => sum + set.size, 0);
  return { camera, emit, listenerCount };
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("useMapPanning", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("はじめは隠さない", () => {
    const { camera } = createFakeCamera();
    const { result } = renderHook(() => useMapPanning(camera));
    expect(result.current).toBe(false);
  });

  it("ドラッグが始まったら隠す", () => {
    const { camera, emit } = createFakeCamera();
    const { result } = renderHook(() => useMapPanning(camera));

    emit("dragstart");

    expect(result.current).toBe(true);
  });

  it("止まって（moveend）から少し待って戻す", () => {
    const { camera, emit } = createFakeCamera();
    const { result } = renderHook(() => useMapPanning(camera));

    emit("dragstart");
    emit("dragend");
    emit("moveend");
    advance(PAN_SETTLE_DELAY_MS - 1);
    expect(result.current).toBe(true);

    advance(1);
    expect(result.current).toBe(false);
  });

  it("慣性スクロールのあいだは隠したまま、慣性の moveend から待って戻す", () => {
    const { camera, emit } = createFakeCamera();
    const { result } = renderHook(() => useMapPanning(camera));

    emit("dragstart");
    emit("dragend");
    // 指を離したあとも慣性で動いている（moveend はまだ来ない）
    advance(1500);
    expect(result.current).toBe(true);

    emit("moveend");
    advance(PAN_SETTLE_DELAY_MS - 1);
    expect(result.current).toBe(true);

    advance(1);
    expect(result.current).toBe(false);
  });

  it("戻す前にまたドラッグが始まったら、戻すのを取り消す（続けてパンしてもチカチカしない）", () => {
    const { camera, emit } = createFakeCamera();
    const { result } = renderHook(() => useMapPanning(camera));

    emit("dragstart");
    emit("dragend");
    emit("moveend");
    advance(PAN_SETTLE_DELAY_MS - 100);
    emit("dragstart");
    advance(PAN_END_FALLBACK_MS * 2);
    expect(result.current).toBe(true);

    emit("dragend");
    emit("moveend");
    advance(PAN_SETTLE_DELAY_MS);
    expect(result.current).toBe(false);
  });

  it("プログラムの移動（flyTo・easeTo・追従など）では隠さない", () => {
    const { camera, emit } = createFakeCamera();
    const { result } = renderHook(() => useMapPanning(camera));

    emit("movestart");
    emit("move");
    emit("moveend");
    advance(PAN_END_FALLBACK_MS);

    expect(result.current).toBe(false);
  });

  it("ドラッグ中に届いた moveend（止められたアニメーションの分）では戻さない", () => {
    const { camera, emit } = createFakeCamera();
    const { result } = renderHook(() => useMapPanning(camera));

    emit("dragstart");
    emit("moveend");
    advance(PAN_END_FALLBACK_MS * 2);
    expect(result.current).toBe(true);

    emit("dragend");
    emit("moveend");
    advance(PAN_SETTLE_DELAY_MS);
    expect(result.current).toBe(false);
  });

  it("dragend のあと moveend が来なくても、保険の時間で戻す", () => {
    const { camera, emit } = createFakeCamera();
    const { result } = renderHook(() => useMapPanning(camera));

    emit("dragstart");
    emit("dragend");
    advance(PAN_END_FALLBACK_MS - 1);
    expect(result.current).toBe(true);

    advance(1);
    expect(result.current).toBe(false);
  });

  it("地図が外れたら購読をやめて、隠したままにしない", () => {
    const { camera, emit, listenerCount } = createFakeCamera();
    const { result, rerender } = renderHook(
      ({ map }: { map: MapCamera | null }) => useMapPanning(map),
      { initialProps: { map: camera as MapCamera | null } }
    );

    emit("dragstart");
    expect(result.current).toBe(true);
    expect(listenerCount()).toBeGreaterThan(0);

    rerender({ map: null });

    expect(listenerCount()).toBe(0);
    expect(result.current).toBe(false);
  });
});

describe("hideWhilePanningClass", () => {
  it("隠すときは押せなくして、透明にする。動きを減らす設定では上へずらさない", () => {
    const classes = hideWhilePanningClass(true).split(" ");
    expect(classes).toEqual(
      expect.arrayContaining(["pointer-events-none", "opacity-0", "motion-reduce:transform-none"])
    );
  });

  it("出しているときは transform を付けない（中の fixed 要素の基準を変えないため）", () => {
    const classes = hideWhilePanningClass(false).split(" ");
    expect(classes).not.toContain("pointer-events-none");
    expect(classes.some((name) => name.includes("translate"))).toBe(false);
  });
});
