'use client';

/**
 * useNearbyPromptVisibility
 *
 * 「このへん、なにがある？」ボタンの出現ロジック（Discussion #392 確定仕様）。
 *
 * - 対象ズーム帯（丁目が見える帯）でのみ表示する
 * - ユーザー操作による移動が静止したら、ズーム変化あり→0.5秒／
 *   パン・ドラッグのみ→1秒後にフェード表示する
 * - 再びズーム/パンが始まったら即座に消す
 * - プログラム発の移動（flyTo / setView / スキップズーム補正 /
 *   道スナップ panTo など）は無視する。自動移動のたびにチラつかせない
 * - 回転のみのジェスチャー（パン・ズームを伴わない2本指回転）は
 *   Leaflet の move/zoom イベントを発火させないため、
 *   isGestureActive（MapView からの通知）で別途ハンドリングする
 *
 * 【ユーザー操作の判定】
 * このマップはパン・ピンチを独自ジェスチャ層が panBy / setZoomAround で
 * 実行するため、Leaflet イベントだけではユーザー操作とプログラム移動を
 * 区別できない。そこで document への capture リスナーで直近の
 * ポインター/ホイール入力を記録し、「入力の直後・最中に起きた移動」だけを
 * ユーザー操作として扱う。プログラム発の移動は入力を伴わないので除外される
 * （タップ起点の flyTo は帯の外へ飛ぶため、結果として表示されない）。
 */

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';

/** 入力からこの時間内に起きた地図移動はユーザー操作とみなす（ホイール慣性・スナップ追従込み） */
const USER_INPUT_ATTRIBUTION_MS = 1600;
const SHOW_DELAY_AFTER_ZOOM_MS = 500;
const SHOW_DELAY_AFTER_PAN_MS = 1000;

type UseNearbyPromptVisibilityArgs = {
  map: LeafletMap | null;
  /** true の間は表示せず、スケジュールも止める（パネル・相談・検索モード中など） */
  suppressed: boolean;
  /** 出現対象のズーム帯 [minZoom, maxZoom) */
  minZoom: number;
  maxZoom: number;
  /**
   * 2本指ジェスチャー（回転・ピンチ）が進行中かどうか。
   * 回転のみの操作は move/zoom を発火させないため、この入力で
   * ジェスチャー中の非表示・終了後の再表示スケジュールを行う。
   */
  isGestureActive?: boolean;
};

export function useNearbyPromptVisibility({
  map,
  suppressed,
  minZoom,
  maxZoom,
  isGestureActive = false,
}: UseNearbyPromptVisibilityArgs): boolean {
  const [visible, setVisible] = useState(false);
  const stateRef = useRef({
    lastUserInputAt: 0,
    activePointers: 0,
    /** ユーザー操作による移動バースト中かどうか */
    burstActive: false,
    /** バースト中にズーム変化があったか（表示遅延の判定用） */
    burstHadZoom: false,
    suppressed,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const state = stateRef.current;
    state.suppressed = suppressed;
    if (suppressed) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      state.burstActive = false;
      state.burstHadZoom = false;
      setVisible(false);
    }
  }, [suppressed]);

  useEffect(() => {
    if (!map) return;
    const state = stateRef.current;

    const isUserAttributed = () =>
      state.activePointers > 0 ||
      Date.now() - state.lastUserInputAt < USER_INPUT_ATTRIBUTION_MS;

    const isInBand = () => {
      const zoom = map.getZoom();
      return zoom >= minZoom && zoom < maxZoom;
    };

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const scheduleShow = () => {
      clearTimer();
      if (state.suppressed) return;
      const delay = state.burstHadZoom
        ? SHOW_DELAY_AFTER_ZOOM_MS
        : SHOW_DELAY_AFTER_PAN_MS;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (state.suppressed) return;
        // 指が残っている間は静止とみなさない（pointerup 側で再スケジュール）
        if (state.activePointers > 0) return;
        state.burstActive = false;
        state.burstHadZoom = false;
        if (isInBand()) {
          setVisible(true);
        }
      }, delay);
    };

    const handleMove = () => {
      if (!isUserAttributed()) return; // プログラム発の移動は無視
      state.burstActive = true;
      setVisible(false);
      scheduleShow();
    };

    const handleZoom = () => {
      if (!isUserAttributed()) return;
      state.burstHadZoom = true;
      handleMove();
    };

    const handleMoveEnd = () => {
      if (state.burstActive && isUserAttributed()) {
        scheduleShow();
      }
    };

    const handleZoomEnd = () => {
      if (!isInBand()) {
        // 帯の外に出たら（プログラム発でも）必ず隠す
        clearTimer();
        state.burstActive = false;
        state.burstHadZoom = false;
        setVisible(false);
        return;
      }
      if (state.burstActive && isUserAttributed()) {
        scheduleShow();
      }
    };

    const handlePointerDown = () => {
      state.activePointers += 1;
      state.lastUserInputAt = Date.now();
    };

    const handlePointerUp = () => {
      state.activePointers = Math.max(0, state.activePointers - 1);
      state.lastUserInputAt = Date.now();
      if (state.burstActive && state.activePointers === 0) {
        scheduleShow();
      }
    };

    const handleWheel = () => {
      state.lastUserInputAt = Date.now();
    };

    const listenerOptions: AddEventListenerOptions = {
      capture: true,
      passive: true,
    };

    map.on('move', handleMove);
    map.on('zoom', handleZoom);
    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleZoomEnd);
    document.addEventListener('pointerdown', handlePointerDown, listenerOptions);
    document.addEventListener('pointerup', handlePointerUp, listenerOptions);
    document.addEventListener('pointercancel', handlePointerUp, listenerOptions);
    document.addEventListener('wheel', handleWheel, listenerOptions);

    return () => {
      map.off('move', handleMove);
      map.off('zoom', handleZoom);
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleZoomEnd);
      document.removeEventListener('pointerdown', handlePointerDown, listenerOptions);
      document.removeEventListener('pointerup', handlePointerUp, listenerOptions);
      document.removeEventListener('pointercancel', handlePointerUp, listenerOptions);
      document.removeEventListener('wheel', handleWheel, listenerOptions);
      clearTimer();
    };
  }, [map, minZoom, maxZoom]);

  // 回転のみのジェスチャーは上の effect の move/zoom リスナーが拾えないため、
  // ジェスチャー中フラグの立ち上がり/立ち下がりだけを見て同じ burst 挙動
  // （開始で即非表示、終了でパンと同じ遅延スケジュール）を適用する
  const prevGestureActiveRef = useRef(false);
  useEffect(() => {
    if (!map) return;
    if (isGestureActive === prevGestureActiveRef.current) return;
    prevGestureActiveRef.current = isGestureActive;
    const state = stateRef.current;

    if (isGestureActive) {
      state.lastUserInputAt = Date.now();
      state.burstActive = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setVisible(false);
      return;
    }

    // ジェスチャー終了。パンと同じ遅延でスケジュールする
    if (!state.burstActive || state.suppressed) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (state.suppressed || state.activePointers > 0) return;
      state.burstActive = false;
      state.burstHadZoom = false;
      const zoom = map.getZoom();
      if (zoom >= minZoom && zoom < maxZoom) {
        setVisible(true);
      }
    }, SHOW_DELAY_AFTER_PAN_MS);
  }, [isGestureActive, map, minZoom, maxZoom]);

  return visible;
}
