"use client";

import { useState, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import QrScanner from "@/app/(public)/my-shop/coupon/QrScanner";
import { unlockItem } from "@/lib/storage/encyclopedia";
import { ENCYCLOPEDIA_ITEMS } from "@/data/encyclopediaItems";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy, Sparkles } from "lucide-react";
import Link from "next/link";

function ScanPageContent() {
  const router = useRouter();
  const [unlockedItem, setUnlockedItem] = useState<typeof ENCYCLOPEDIA_ITEMS[0] | null>(null);
  const [isScanning, setIsScanning] = useState(true);

  const handleScan = useCallback((value: string) => {
    // QRコードの値が百科事典アイテムの trigger.qrValue と一致するかチェック
    const item = ENCYCLOPEDIA_ITEMS.find(i => i.trigger.qrValue === value);

    if (item) {
      const isNew = unlockItem(item.id);
      if (isNew) {
        setUnlockedItem(item);
        setIsScanning(false);
        // バイブレーション（対応端末のみ）
        if (typeof window !== 'undefined' && window.navigator.vibrate) {
          window.navigator.vibrate(200);
        }
      } else {
        // すでに解放済みの場合も、とりあえずそのアイテムを表示するか、トーストを出す
        // ここではシンプルに図鑑に戻るか、メッセージを出す
        router.push('/encyclopedia');
      }
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <div className="relative flex min-h-screen flex-col items-center justify-center p-6">
        <Link
          href="/encyclopedia"
          className="absolute top-6 right-6 z-20 rounded-full bg-white/10 p-2 backdrop-blur-md"
        >
          <X size={24} />
        </Link>

        {isScanning ? (
          <div className="w-full max-w-sm space-y-8 text-center">
            <div className="space-y-2">
              <h1 className="text-xl font-bold">QRコードをスキャン</h1>
              <p className="text-sm text-slate-400">店頭のQRコードを読み取ってアイテムをゲット！</p>
            </div>

            <div className="relative aspect-square overflow-hidden rounded-3xl border-4 border-amber-500/50 bg-black shadow-2xl shadow-amber-500/20">
              <QrScanner active={isScanning} onScan={handleScan} />

              {/* スキャン枠の演出 */}
              <div className="absolute inset-0 pointer-events-none border-[40px] border-black/20" />
              <motion.div
                animate={{ top: ["10%", "90%", "10%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute left-[10%] right-[10%] h-0.5 bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.8)]"
              />
            </div>

            <div className="pt-4">
              <p className="text-xs text-slate-500">
                カメラへのアクセスを許可してください
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence>
            {unlockedItem && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center text-center"
              >
                <div className="relative mb-8">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 -m-8 rounded-full bg-gradient-to-tr from-amber-500/0 via-amber-500/40 to-orange-500/0 blur-xl"
                  />
                  <div className="relative flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-white text-6xl shadow-2xl shadow-amber-500/40 ring-4 ring-amber-400">
                    {unlockedItem.emoji}
                  </div>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="absolute -bottom-4 -right-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg"
                  >
                    <Trophy size={20} />
                  </motion.div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-amber-400">
                    <Sparkles size={16} />
                    <span className="text-xs font-black uppercase tracking-[0.2em]">New Discovery!</span>
                    <Sparkles size={16} />
                  </div>
                  <h2 className="text-3xl font-black">{unlockedItem.name}</h2>
                  <p className="text-slate-400 max-w-[280px] mx-auto text-sm leading-relaxed">
                    おめでとう！日曜市の新しい魅力を図鑑に登録しました。
                  </p>
                </div>

                <div className="mt-12 flex flex-col gap-3 w-full max-w-[240px]">
                  <Link
                    href="/encyclopedia"
                    className="rounded-2xl bg-amber-500 py-4 text-sm font-bold text-white shadow-lg shadow-amber-500/30 transition active:scale-95"
                  >
                    図鑑を見る
                  </Link>
                  <button
                    onClick={() => {
                      setUnlockedItem(null);
                      setIsScanning(true);
                    }}
                    className="rounded-2xl bg-white/10 py-4 text-sm font-bold text-white transition active:scale-95"
                  >
                    続けてスキャン
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </main>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
      <ScanPageContent />
    </Suspense>
  );
}
