"use client";

import NavigationBar from "./NavigationBar";
import MapLoadingScreen from "./MapLoadingScreen";
import { MAP_LOAD_PROGRESS, laterStage, useMapLoading, type MapLoadStage } from "./MapLoadingProvider";

type MapLoadingOverlayProps = {
  /** 出す側が保証できる最低段階。ページ側が出すときは "page" 以上として描く */
  minStage?: MapLoadStage;
  /** 到着演出（地図がその下から開ける）に入っている */
  leaving?: boolean;
};

/**
 * マップの読み込み中に画面全体へかぶせる層。
 * loading.tsx（サーバー取得中）・MapLoadingProvider（遷移中）・マップページ（地図の描画中）が同じものを使う。
 * 進み具合は Provider の段階から取り、道の点の灯りと下のゲージが同じ値を見る。
 */
export default function MapLoadingOverlay({ minStage = "navigating", leaving = false }: MapLoadingOverlayProps) {
  const { stage } = useMapLoading();
  const shownStage = leaving ? "ready" : laterStage(stage, minStage);
  const progress = MAP_LOAD_PROGRESS[shownStage];

  return (
    <div
      className={`map-loading-overlay fixed inset-0 z-[9999] flex flex-col bg-gradient-to-b from-amber-50 via-orange-50 to-white text-gray-800${
        leaving ? " is-leaving" : ""
      }`}
      aria-busy={!leaving}
    >
      <div className="relative flex flex-1 items-center justify-center">
        <MapLoadingScreen progress={progress} />
      </div>

      {/* 下部のゲージ。ナビゲーションバー（h-14）のすぐ上に細く置く */}
      <div
        className="pointer-events-none fixed inset-x-0"
        style={{ bottom: "calc(3.5rem + var(--safe-bottom, 0px))" }}
        role="progressbar"
        aria-label="地図を読み込んでいます"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div className="h-[3px] w-full bg-amber-100/70">
          <div
            className="map-loading-gauge h-full bg-nicchyo-primary"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>

      <NavigationBar activeHref="/map" />
    </div>
  );
}
