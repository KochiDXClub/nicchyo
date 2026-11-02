'use client';

/**
 * useMapPanning
 *
 * 人が地図をドラッグ（パン）しているあいだ true を返す。
 * 画面上部に浮いている検索バー・チップ・おでかけ／現在地ボタンを、パンのあいだだけ
 * 柔らかく隠すのに使う。スマホでは上の UI が画面の上 280px ほどを覆うので、
 * 地図を動かして探しているときに見たい場所が隠れてしまうため。
 *
 * 【隠す・戻すの判定】
 * - dragstart で隠す。dragstart は人のドラッグでだけ飛ぶので、flyTo / easeTo /
 *   現在地の追従 / 道への吸着といったプログラムの移動では隠れない
 * - 止まったら（慣性スクロールが終わったときの moveend）PAN_SETTLE_DELAY_MS 待って戻す。
 *   そのあいだにまたドラッグが始まれば取り消すので、続けてパンしてもチカチカしない
 * - ドラッグ中に届いた moveend は数えない。ドラッグを始めた瞬間に止められた
 *   アニメーション（flyTo など）の moveend が、dragstart と前後して届くことがあるため
 * - dragend のあと moveend が来ない経路（MapLibre の stop() でジェスチャーが打ち切られた
 *   ときなど）でも隠れたままにならないよう、dragend で保険のタイマーを置く
 *
 * ピンチ・ホイールのズームは対象にしていない。ただし MapLibre ではピンチでも
 * 2本指の中心が動けば drag として扱われるので、そのときは隠れる。
 */

import { useEffect, useState } from 'react';
import type { MapCamera } from '../types/mapCamera';

/** 止まってから上の UI を戻すまでの間。すぐ戻すと、少し止めて続けて動かすたびにチカチカする */
export const PAN_SETTLE_DELAY_MS = 400;

/**
 * dragend のあと moveend が来なかったときに戻すまでの時間。
 * MapLibre の慣性スクロールは既定値で最長 2 秒弱（最高速 1400px/s ÷ (減速 2500 × 0.3)）
 * なので、それより長くとって、慣性の途中で戻ってしまわないようにする
 */
export const PAN_END_FALLBACK_MS = 2500;

export function useMapPanning(map: MapCamera | null): boolean {
  const [panning, setPanning] = useState(false);

  useEffect(() => {
    if (!map) return;
    /** dragstart〜dragend のあいだ */
    let dragging = false;
    /** 隠してから戻すまでのあいだ（プログラムの移動の moveend を無視するため） */
    let active = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer === null) return;
      clearTimeout(timer);
      timer = null;
    };

    const revealAfter = (delay: number) => {
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        active = false;
        setPanning(false);
      }, delay);
    };

    const handleDragStart = () => {
      dragging = true;
      active = true;
      clearTimer();
      setPanning(true);
    };

    const handleDragEnd = () => {
      dragging = false;
      if (active) revealAfter(PAN_END_FALLBACK_MS);
    };

    const handleMoveEnd = () => {
      if (!active || dragging) return;
      revealAfter(PAN_SETTLE_DELAY_MS);
    };

    map.on('dragstart', handleDragStart);
    map.on('dragend', handleDragEnd);
    map.on('moveend', handleMoveEnd);
    return () => {
      map.off('dragstart', handleDragStart);
      map.off('dragend', handleDragEnd);
      map.off('moveend', handleMoveEnd);
      clearTimer();
      setPanning(false);
    };
  }, [map]);

  return panning;
}

/**
 * パンのあいだ隠す上部 UI に付けるクラス。
 *
 * 透明にしながら少し上へ逃がし、押せないようにする（隠れたボタンの誤タップを防ぐ）。
 * 動きを減らす設定では上へずらさず、不透明度だけ変える。
 *
 * 出しているときは transform を付けない。transform があると、中に fixed の要素を
 * 置いたときに位置の基準が画面からこの要素に変わってしまうため。
 * transform: none ⇄ translate のあいだも transition は効く。
 */
export function hideWhilePanningClass(panning: boolean): string {
  const transition = 'transition-[opacity,transform] duration-300 ease-out-soft';
  return panning
    ? `${transition} pointer-events-none opacity-0 -translate-y-2 motion-reduce:transform-none`
    : transition;
}
