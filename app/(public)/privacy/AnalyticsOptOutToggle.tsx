"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import {
  ANALYTICS_OPT_OUT_CHANGE_EVENT,
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
} from "@/lib/analytics/consentClient";

/**
 * アクセス解析を止めるスイッチ
 *
 * 設定はこの端末のブラウザにだけ保存する。サーバーには送らない。
 * 読み込みが終わるまでは状態が分からないので、確定してから描く。
 */
export default function AnalyticsOptOutToggle() {
  const [optedOut, setOptedOut] = useState<boolean | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    const read = () => setOptedOut(isAnalyticsOptedOut());
    read();
    window.addEventListener(ANALYTICS_OPT_OUT_CHANGE_EVENT, read);
    return () => window.removeEventListener(ANALYTICS_OPT_OUT_CHANGE_EVENT, read);
  }, []);

  useEffect(() => {
    if (!justSaved) return;
    const timer = window.setTimeout(() => setJustSaved(false), 2400);
    return () => window.clearTimeout(timer);
  }, [justSaved]);

  const toggle = () => {
    if (optedOut === null) return;
    const next = !optedOut;
    setAnalyticsOptOut(next);
    setOptedOut(next);
    setJustSaved(true);
  };

  const enabled = optedOut === false;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">この端末でのアクセス解析</p>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            止めると、閲覧したページの記録も Google アナリティクスへの送信も行いません。
            サービスの利用そのものには影響しません。
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="この端末でのアクセス解析"
          disabled={optedOut === null}
          onClick={toggle}
          className={`relative mt-1 inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-amber-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <p className="mt-3 flex min-h-5 items-center gap-1.5 text-xs">
        {optedOut === null ? (
          <span className="flex items-center gap-1.5 text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            設定を読み込んでいます
          </span>
        ) : justSaved ? (
          <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
            <Check className="h-3.5 w-3.5" />
            {optedOut ? "この端末での解析を止めました" : "この端末での解析を再開しました"}
          </span>
        ) : (
          <span className="text-gray-400">
            {optedOut ? "現在：止めています" : "現在：有効です"}
          </span>
        )}
      </p>

      <p className="mt-3 text-xs leading-relaxed text-gray-400">
        この設定はお使いのブラウザに保存されます。別の端末やブラウザ、閲覧データを消したあとは、
        あらためて設定してください。
      </p>
    </div>
  );
}
