"use client";

import { useEffect, useState } from "react";

/**
 * マップの読み込み中に出す画面。
 *
 * loading.tsx（サーバー取得中）と MapLoadingProvider のオーバーレイ（遷移〜地図描画まで）で
 * 同じものを使う。初回訪問なら日曜市の歩き方を、2 回目以降は一言メッセージを出して
 * 待ち時間を案内に充てる。
 */

// FirstVisitGuide と同じキーを「読むだけ」で使う。書き込みはあちらに任せる
const GUIDE_STORAGE_KEY = "nicchyo-first-visit-guide-completed";

/** 2 回目以降に出す一言。1 つ目はサーバー描画と一致させるため固定で出す */
const TIPS = [
  "日曜市は毎週日曜、追手筋に約300店が並びます。",
  "気になったお店は「買い物リスト」に入れておけます。",
  "迷ったら「にちよさん」に話しかけてみてください。",
  "地図は2本指でくるっと回せます。歩く向きに合わせてどうぞ。",
  "旬のものはお店の人に聞くのがいちばんです。",
];

/** 初回訪問のときに出す歩き方 */
const FIRST_VISIT_STEPS = [
  { icon: "🗺️", text: "地図を広げると、出ているお店がそのまま並びます" },
  { icon: "🔍", text: "上の検索から、食べ物や道具でお店を絞れます" },
  { icon: "🧺", text: "気になったお店は買い物リストに残せます" },
];

const TIP_INTERVAL_MS = 2600;

export default function MapLoadingScreen() {
  // サーバーとクライアントの初回描画を一致させるため、判定前は「2 回目以降・1 つ目の一言」を出す
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    try {
      setIsFirstVisit(localStorage.getItem(GUIDE_STORAGE_KEY) !== "true");
    } catch {
      // プライベートモードなどで読めないときは通常表示のまま
    }
  }, []);

  useEffect(() => {
    if (isFirstVisit) return;
    const timer = window.setInterval(
      () => setTipIndex((prev) => (prev + 1) % TIPS.length),
      TIP_INTERVAL_MS
    );
    return () => window.clearInterval(timer);
  }, [isFirstVisit]);

  return (
    <div className="flex flex-col items-center gap-5 px-8">
      <div className="map-walker relative h-20 w-20 text-amber-700">
        <svg
          className="map-walker-frame is-1"
          viewBox="0 0 80 80"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="40" cy="16" r="6" />
          <line x1="40" y1="22" x2="40" y2="46" />
          <line x1="40" y1="30" x2="28" y2="36" />
          <line x1="40" y1="30" x2="52" y2="34" />
          <line x1="40" y1="46" x2="30" y2="64" />
          <line x1="40" y1="46" x2="52" y2="62" />
        </svg>

        <svg
          className="map-walker-frame is-2"
          viewBox="0 0 80 80"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="40" cy="16" r="6" />
          <line x1="40" y1="22" x2="40" y2="46" />
          <line x1="40" y1="30" x2="30" y2="34" />
          <line x1="40" y1="30" x2="54" y2="38" />
          <line x1="40" y1="46" x2="28" y2="62" />
          <line x1="40" y1="46" x2="54" y2="64" />
        </svg>

        <svg
          className="map-walker-frame is-3"
          viewBox="0 0 80 80"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="40" cy="16" r="6" />
          <line x1="40" y1="22" x2="40" y2="46" />
          <line x1="40" y1="30" x2="26" y2="38" />
          <line x1="40" y1="30" x2="54" y2="36" />
          <line x1="40" y1="46" x2="34" y2="64" />
          <line x1="40" y1="46" x2="56" y2="58" />
        </svg>
      </div>

      <div className="text-xs font-semibold tracking-[0.35em] text-amber-700">LOADING</div>

      {/* 待っている間に読めるもの。高さを固定して、切り替わっても画面が揺れないようにする */}
      <div
        className="flex min-h-[104px] w-full max-w-sm items-start justify-center"
        aria-live="polite"
      >
        {isFirstVisit ? (
          <div className="w-full rounded-2xl bg-white/70 px-5 py-4 text-left shadow-sm">
            <p className="mb-3 text-xs font-bold tracking-wide text-amber-700">
              はじめまして。日曜市の歩き方です
            </p>
            <ul className="space-y-2">
              {FIRST_VISIT_STEPS.map((step) => (
                <li key={step.text} className="flex items-start gap-2.5 text-[13px] leading-snug text-gray-700">
                  <span aria-hidden="true" className="shrink-0 text-base leading-none">
                    {step.icon}
                  </span>
                  <span>{step.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p
            key={tipIndex}
            className="map-loading-tip text-center text-[13px] leading-relaxed text-gray-600"
          >
            {TIPS[tipIndex]}
          </p>
        )}
      </div>
    </div>
  );
}
