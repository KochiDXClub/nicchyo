"use client";

import { useEffect, useState } from "react";

const GUIDE_STORAGE_KEY = "nicchyo-first-visit-guide-completed";

export default function FirstVisitGuide() {
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const completed = localStorage.getItem(GUIDE_STORAGE_KEY);
    if (!completed) {
      // 少し遅延させて表示
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = () => {
    setStep((prev) => prev + 1);
  };

  const handleComplete = () => {
    setIsVisible(false);
    localStorage.setItem(GUIDE_STORAGE_KEY, "true");
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 px-4 transition-opacity duration-300">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="relative h-48 bg-amber-100">
           {/* Illustration placeholder or pattern */}
           <div className="absolute inset-0 flex items-center justify-center opacity-20">
             <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor" className="text-amber-500">
               <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
             </svg>
           </div>
           {step === 0 && (
             <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-6xl">🎉</span>
             </div>
           )}
           {step === 1 && (
             <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-6xl">🤖</span>
             </div>
           )}
           {step === 2 && (
             <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-6xl">👆</span>
             </div>
           )}
        </div>

        <div className="p-6">
          {step === 0 && (
            <div className="space-y-4 text-center">
              <h2 className="text-2xl font-bold text-gray-900">高知の日曜市へようこそ！</h2>
              <p className="text-gray-600 leading-relaxed">
                ここでは、約300のお店が並ぶ<br/>日本最大級の街路市を楽しめます。<br/>
                まずは簡単な使い方をご案内します。
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 text-center">
              <h2 className="text-xl font-bold text-gray-900">「にちよさん」に聞いてみよう</h2>
              <p className="text-gray-600 leading-relaxed">
                右下のおばあちゃんAIガイドが<br/>
                あなたの旅をサポートします。<br/>
                <span className="font-bold text-amber-600">「おすすめのランチは？」</span><br/>
                など、気軽に話しかけてください。
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 text-center">
              <h2 className="text-xl font-bold text-gray-900">お店をタップして詳しく</h2>
              <p className="text-gray-600 leading-relaxed">
                地図上のお店をタップすると、<br/>
                詳しい情報や写真が見られます。<br/>
                お気に入りのお店を見つけましょう！
              </p>
            </div>
          )}

          <div className="mt-8 flex justify-center gap-3">
             {step < 2 ? (
               <button
                 type="button"
                 onClick={handleNext}
                 className="w-full rounded-xl bg-amber-500 py-3 text-base font-bold text-white shadow-md transition hover:bg-amber-600 active:scale-95"
               >
                 次へ
               </button>
             ) : (
               <button
                 type="button"
                 onClick={handleComplete}
                 className="w-full rounded-xl bg-amber-500 py-3 text-base font-bold text-white shadow-md transition hover:bg-amber-600 active:scale-95"
               >
                 マップをはじめる
               </button>
             )}
          </div>

          <div className="mt-4 flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full transition-colors ${i === step ? "bg-amber-500" : "bg-gray-200"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
