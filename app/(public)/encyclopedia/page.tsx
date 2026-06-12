"use client";

import { useState } from "react";
import { ENCYCLOPEDIA_ITEMS, type EncyclopediaItem } from "@/data/encyclopediaItems";
import { useEncyclopedia } from "@/lib/storage/encyclopedia";
import NavigationBar from "@/app/components/NavigationBar";
import { Camera, QrCode, MapPin, Trophy, Star, Share2 } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function EncyclopediaPage() {
  const { unlockedIds } = useEncyclopedia();
  const [selectedItem, setSelectedItem] = useState<EncyclopediaItem | null>(null);

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
                className={`relative flex flex-col items-center rounded-3xl p-5 text-center transition-all ${
                  isUnlocked
                    ? "bg-white shadow-sm ring-1 ring-slate-200"
                    : "bg-slate-100 ring-1 ring-slate-200 grayscale opacity-70"
                }`}
              >
                <div className={`mb-3 flex h-16 w-16 items-center justify-center rounded-2xl text-4xl ${
                  isUnlocked ? "bg-amber-50" : "bg-slate-200"
                }`}>
                  {isUnlocked ? item.emoji : "❓"}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900">
                    {isUnlocked ? item.name : "？？？"}
                  </p>
                  <div className="flex justify-center gap-0.5">
                    {Array.from({ length: item.rarity === 'super_rare' ? 3 : item.rarity === 'rare' ? 2 : 1 }).map((_, i) => (
                      <Star key={i} className={`h-3 w-3 ${isUnlocked ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                    ))}
                  </div>
                </div>

                {!isUnlocked && (
                  <div className="absolute top-2 right-2">
                    {item.trigger.type === 'qr' ? (
                      <QrCode className="h-4 w-4 text-slate-400" />
                    ) : (
                      <MapPin className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                )}
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
              {unlockedIds.includes(selectedItem.id) ? (
                <div className="p-8">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50 text-5xl shadow-inner`}>
                      {selectedItem.emoji}
                    </div>
                    <div className="text-right">
                      <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        {selectedItem.category === 'food' ? 'グルメ' : selectedItem.category === 'craft' ? '工芸品' : '季節限定'}
                      </span>
                      <h2 className="mt-2 text-2xl font-black text-slate-900">{selectedItem.name}</h2>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">解説</h3>
                      <p className="text-slate-600 leading-relaxed">{selectedItem.description}</p>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        href={`/encyclopedia/camera?item=${selectedItem.id}`}
                        className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-sm font-bold text-white shadow-lg active:scale-[0.98] transition-transform"
                      >
                        <Camera size={18} />
                        記念撮影をする
                      </Link>
                      <button className="flex h-13 w-13 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 active:scale-[0.98] transition-transform">
                        <Share2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-4xl text-slate-300">
                    ❓
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">まだ見つかっていません</h2>
                  <p className="mt-3 text-slate-500">このアイテムを解放するためのヒント：</p>
                  <div className="mt-4 rounded-2xl bg-amber-50 p-5 text-sm font-medium text-amber-800 ring-1 ring-amber-100">
                    「{selectedItem.hint}」
                  </div>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="mt-8 w-full rounded-2xl bg-slate-100 py-4 text-sm font-bold text-slate-600"
                  >
                    閉じる
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <NavigationBar />
    </main>
  );
}
