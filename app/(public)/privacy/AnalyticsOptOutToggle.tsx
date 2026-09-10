"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";

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
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    const read = () => setOptedOut(isAnalyticsOptedOut());
    read();
    // 同じ画面の中での切り替え
    window.addEventListener(ANALYTICS_OPT_OUT_CHANGE_EVENT, read);
    // 別のタブで切り替えられたとき（storage は他のタブからのみ届く）
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(ANALYTICS_OPT_OUT_CHANGE_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  useEffect(() => {
    if (!justSaved) return;
    const timer = window.setTimeout(() => setJustSaved(false), 2400);
    return () => window.clearTimeout(timer);
  }, [justSaved]);

  const toggle = () => {
    if (optedOut === null) return;
    const next = !optedOut;
    // 保存できなかったときは表示も変えない。切り替わったように見せると、
    // 次の来訪で元に戻っていることに気づけない
    if (!setAnalyticsOptOut(next)) {
      setJustSaved(false);
      setSaveFailed(true);
      return;
    }
    setSaveFailed(false);
    setOptedOut(next);
    setJustSaved(true);
  };

  const enabled = optedOut === false;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-[0.95rem] font-semibold text-nicchyo-ink">この端末でのアクセス解析</p>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="この端末でのアクセス解析"
          disabled={optedOut === null}
          onClick={toggle}
          className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nicchyo-primary disabled:opacity-50 ${
            enabled ? "bg-nicchyo-primary" : "bg-[#D8CFC0]"
          }`}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <p className="mt-3 text-sm leading-[1.9] text-[#5C574F]">
        お止めになると、ご覧になったページの記録も Google アナリティクスへの送信もいたしません。
        サービスのご利用そのものには影響ございません。
      </p>

      <p className="mt-3 flex min-h-5 items-center gap-1.5 text-xs">
        {optedOut === null ? (
          <span className="flex items-center gap-1.5 text-[#A79E92]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            設定を読み込んでおります
          </span>
        ) : saveFailed ? (
          <span className="flex items-center gap-1.5 font-semibold text-[#B4442E]">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            この端末に設定を保存できませんでした
          </span>
        ) : justSaved ? (
          <span className="flex items-center gap-1.5 font-semibold text-[#3F7F2E]">
            <Check className="h-3.5 w-3.5" />
            {optedOut ? "この端末での解析を止めました" : "この端末での解析を再開しました"}
          </span>
        ) : (
          <span className="text-[#A79E92]">
            {optedOut ? "現在は止めております" : "現在は有効です"}
          </span>
        )}
      </p>

      {saveFailed ? (
        <p className="mt-3 rounded-xl bg-[#FBEFEC] px-4 py-3 text-xs leading-[1.85] text-[#8C4B3A]">
          ブラウザの設定で保存が制限されている可能性がございます（プライベートモードなど）。
          お手数ですが、下でご案内している Google のオプトアウトアドオンをお使いいただくか、
          ブラウザの設定をご確認のうえ、あらためてお試しください。
        </p>
      ) : null}

      <p className="mt-3 text-xs leading-[1.85] text-[#A79E92]">
        この設定はお使いのブラウザに保存されます。別の端末やブラウザをお使いの場合、
        また閲覧データを消去されたあとは、あらためてご設定ください。
      </p>
    </div>
  );
}
