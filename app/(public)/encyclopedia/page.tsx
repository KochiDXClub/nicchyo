"use client";

import { useEffect, useState } from "react";
import { ENCYCLOPEDIA_ITEMS, type EncyclopediaItem } from "@/data/encyclopediaItems";
import { useEncyclopedia } from "@/lib/storage/encyclopedia";
import NavigationBar from "@/app/components/NavigationBar";
import { Camera, QrCode, MapPin, Trophy, Star, Share2 } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import LoadingLantern, { LOADING_LANTERN_DURATION_MS } from "./components/LoadingLantern";

const CATEGORY_LABELS: Record<EncyclopediaItem["category"], string> = {
  food: "グルメ",
  craft: "工芸品",
  seasonal: "季節限定",
};

const RARITY_STARS: Record<EncyclopediaItem["rarity"], number> = {
  normal: 1,
  rare: 2,
  super_rare: 3,
};

export default function EncyclopediaPage() {
  const { unlockedIds } = useEncyclopedia();
  const [selectedItem, setSelectedItem] = useState<EncyclopediaItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), LOADING_LANTERN_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <LoadingLantern />;
  }

  const stats = {
    total: ENCYCLOPEDIA_ITEMS.length,
    unlocked: unlockedIds.length,
    percent: Math.round((unlockedIds.length / ENCYCLOPEDIA_ITEMS.length) * 100),
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-28">
      {/* Header */}
      <div className="bg-white px-4 pt-8 pb-6 shadow-sm ring-1 ring-slate-200">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">日曜市発見図鑑</h1>
              <p className="mt-1 text-sm text-slate-500">日曜市の魅力を集める冒険に出よう</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-100">
              <Trophy className="h-7 w-7 text-amber-500" />
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
              <span>コレクションの進捗</span>
              <span className="text-amber-600">{stats.unlocked} / {stats.total}</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stats.percent}%` }}
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-6">
        {/* Grid */}
        <div className="grid grid-cols-2 gap-4">
          {ENCYCLOPEDIA_ITEMS.map((item) => {
            const isUnlocked = unlockedIds.includes(item.id);
            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => setSelectedItem(item)}
                className={`relative flex flex-col items-center gap-3 rounded-3xl p-5 text-center transition-all ${
                  isUnlocked
                    ? "bg-white shadow-sm ring-1 ring-slate-200 hover:shadow-md"
                    : "bg-slate-50 ring-1 ring-dashed ring-slate-300"
                }`}
              >
                {/* カテゴリーバッジ */}
                <span className="absolute left-3 top-3 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold tracking-wide text-slate-500">
                  {CATEGORY_LABELS[item.category]}
                </span>

                {/* 未開放時の取得方法アイコン */}
                {!isUnlocked && (
                  <span className="absolute right-3 top-3 text-slate-400">
                    {item.trigger.type === "qr" ? (
                      <QrCode className="h-4 w-4" />
                    ) : (
                      <MapPin className="h-4 w-4" />
                    )}
                  </span>
                )}

                {/* エンブレム */}
                <div
                  className={`mt-3 flex h-16 w-16 items-center justify-center rounded-2xl text-4xl ${
                    isUnlocked ? "bg-amber-50 ring-1 ring-amber-100" : "bg-slate-100"
                  }`}
                >
                  <span className={isUnlocked ? "" : "opacity-25 [filter:grayscale(1)_brightness(0)]"}>
                    {item.emoji}
                  </span>
                </div>

                {/* 名前 */}
                <p className={`text-sm font-bold ${isUnlocked ? "text-slate-900" : "text-slate-400"}`}>
                  {item.name}
                </p>

                {/* レアリティ */}
                <div className="flex justify-center gap-0.5">
                  {Array.from({ length: RARITY_STARS[item.rarity] }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${
                        isUnlocked ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"
                      }`}
                    />
                  ))}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Item Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[10000] flex items-end justify-center p-4 sm:items-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-lg overflow-hidden rounded-[2.5rem] bg-white shadow-2xl"
            >
              {(() => {
                const isUnlocked = unlockedIds.includes(selectedItem.id);
                return (
                  <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                      <div className={`flex h-20 w-20 items-center justify-center rounded-3xl text-5xl shadow-inner ${
                        isUnlocked ? "bg-amber-50" : "bg-slate-100"
                      }`}>
                        <span className={isUnlocked ? "" : "opacity-30 [filter:grayscale(1)_brightness(0)]"}>
                          {selectedItem.emoji}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          {CATEGORY_LABELS[selectedItem.category]}
                        </span>
                        <h2 className="mt-2 text-2xl font-black text-slate-900">{selectedItem.name}</h2>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">解説</h3>
                        <p className="text-slate-600 leading-relaxed">{selectedItem.description}</p>
                      </div>

                      <Link
                        href={`/map?q=${encodeURIComponent(selectedItem.name)}`}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-nicchyo-primary py-4 text-sm font-bold text-white shadow-lg active:scale-[0.98] transition-transform"
                      >
                        <MapPin size={18} />
                        販売しているお店をチェック
                      </Link>

                      {isUnlocked && (
                        <div className="flex gap-2">
                          <Link
                            href={`/encyclopedia/camera?item=${selectedItem.id}`}
                            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-sm font-bold text-white shadow-lg active:scale-[0.98] transition-transform"
                          >
                            <Camera size={18} />
                            記念撮影をする
                          </Link>
                          <button type="button" disabled aria-label="シェア（準備中）" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 opacity-50 transition-transform">
                            <Share2 size={20} />
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedItem(null)}
                        className="w-full rounded-2xl bg-slate-100 py-4 text-sm font-bold text-slate-600 active:scale-[0.98] transition-transform"
                      >
                        閉じる
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <NavigationBar />
    </main>
  );
}
