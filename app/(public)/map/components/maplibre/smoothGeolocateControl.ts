/**
 * 青い点がなめらかに動く GeolocateControl
 *
 * 標準の GeolocateControl は、位置が届くたび（端末ではだいたい 1 秒ごと）に
 * - 点を新しい位置へ瞬間移動させる
 * - 追従中は精度の円が収まるように fitBounds する（0.5 秒で寄って止まる・精度しだいでズームも変わる）
 * ので、歩いていると点と地図が「1 秒ごとにカクッと動いて止まる」見え方になる。
 *
 * ここでは
 * - 点（と精度の円）を、前の位置から新しい位置まで「位置が届く間隔」をかけて等速で動かす
 * - 追従中は、寄せ（fitBounds）は追従を始めたときの 1 回だけにして、そのあとは点に合わせて中心だけを毎フレーム動かす
 *   （ズームは変えない。ユーザーがピンチ中など地図が動いている間は中心を触らない）
 * - 動きを減らす設定（prefers-reduced-motion）のときはアニメーションせずに移す
 */

import * as maplibregl from "maplibre-gl";

import { distanceMeters } from "../../utils/mapRouteGeometry";

// 位置が届く間隔がこれより短くても、これより速くは動かさない（細かく震えて見えるため）
const MIN_ANIMATION_MS = 300;
// 位置がしばらく届かなかったあとでも、これより長くはかけない（遅れて見えるため）
const MAX_ANIMATION_MS = 1500;
// これより離れた位置へは動かさずに移す（測位のやり直しなどで大きく飛んだとき）
const SNAP_DISTANCE_METERS = 200;

interface LatLng {
  lat: number;
  lng: number;
}

/** 次の位置まで動かす時間。0 なら動かさずに移す */
export function getAnimationDurationMs(intervalMs: number, distanceM: number): number {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return 0;
  if (!Number.isFinite(distanceM) || distanceM > SNAP_DISTANCE_METERS) return 0;
  return Math.min(MAX_ANIMATION_MS, Math.max(MIN_ANIMATION_MS, intervalMs));
}

export function interpolateLatLng(from: LatLng, to: LatLng, progress: number): LatLng {
  const t = Math.min(1, Math.max(0, progress));
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  };
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export class SmoothGeolocateControl extends maplibregl.GeolocateControl {
  // いま画面に出している点の位置（点を出していなければ null）
  private shown: LatLng | null = null;
  private animFrom: LatLng | null = null;
  private animTo: LatLng | null = null;
  private animStart = 0;
  private animDuration = 0;
  private frame: number | null = null;
  private lastFixAt = 0;
  // 追従を始めたときの寄せが終わり、点に合わせて中心を動かしてよい
  private followReady = false;
  private fitPending = false;

  constructor(options: maplibregl.GeolocateControlOptions) {
    super(options);

    // 標準の実装はインスタンスの関数なので、差し替える前に取っておく
    const baseUpdateMarker = this._updateMarker;
    const baseUpdateCamera = this._updateCamera;

    this._updateMarker = (position) => {
      if (!position) {
        this.stopAnimation();
        this.shown = null;
        baseUpdateMarker(position);
        return;
      }
      const target = { lat: position.coords.latitude, lng: position.coords.longitude };
      const now = performance.now();
      const interval = now - this.lastFixAt;
      this.lastFixAt = now;

      if (!this.shown) {
        // 最初の 1 回は標準どおり（点と円を地図に載せる）
        baseUpdateMarker(position);
        this.shown = target;
        return;
      }

      // 2 回目からは載せ直さない（標準は毎回 addTo して DOM を付け直す）。精度の円の大きさだけ更新する
      this._accuracy = position.coords.accuracy;
      this._updateCircleRadiusIfNeeded();

      const duration = prefersReducedMotion() ? 0 : getAnimationDurationMs(interval, distanceMeters(this.shown, target));
      this.animateTo(target, duration);
    };

    this._updateCamera = (position) => {
      // 追従中は点のアニメーションが中心を動かすので、ここでは何もしない
      if (this.followReady) return;
      // 追従を始めたとき（最初の位置・背景から追従へ戻したとき）は標準どおり寄せる
      baseUpdateCamera(position);
      const map = this._map;
      if (!map || this.fitPending) return;
      this.fitPending = true;
      map.once("moveend", () => {
        this.fitPending = false;
        this.followReady = this._watchState === "ACTIVE_LOCK";
      });
    };

    // ユーザーが地図を動かすなどして追従が外れたら、次に追従するときはまた寄せから始める
    this.on("trackuserlocationend", () => {
      this.followReady = false;
    });
  }

  onRemove(): void {
    this.stopAnimation();
    this.shown = null;
    this.followReady = false;
    this.fitPending = false;
    super.onRemove();
  }

  private stopAnimation() {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  private animateTo(target: LatLng, duration: number) {
    this.stopAnimation();
    if (duration <= 0 || !this.shown) {
      this.applyPosition(target);
      return;
    }
    this.animFrom = this.shown;
    this.animTo = target;
    this.animStart = performance.now();
    this.animDuration = duration;

    const step = (ts: number) => {
      if (!this.animFrom || !this.animTo) return;
      const progress = (ts - this.animStart) / this.animDuration;
      this.applyPosition(interpolateLatLng(this.animFrom, this.animTo, progress));
      this.frame = progress < 1 ? requestAnimationFrame(step) : null;
    };
    this.frame = requestAnimationFrame(step);
  }

  private applyPosition(position: LatLng) {
    this.shown = position;
    const lngLat: [number, number] = [position.lng, position.lat];
    this._userLocationDotMarker?.setLngLat(lngLat);
    this._accuracyCircleMarker?.setLngLat(lngLat);

    const map = this._map;
    // ピンチや別のアニメーションの最中は中心を奪わない
    if (!map || !this.followReady || this._watchState !== "ACTIVE_LOCK" || map.isMoving()) return;
    // geolocateSource を付けると、control はこの移動を「ユーザーが動かした」と見なさない（追従が外れない）
    map.jumpTo({ center: lngLat }, { geolocateSource: true });
  }
}
