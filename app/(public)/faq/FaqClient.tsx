"use client";

import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FAQ_DATA, FAQ_CATEGORIES } from "./data";
import Link from "next/link";
import { cn } from "@/lib/utils";
import EmptyState from "@/components/EmptyState";

export default function FaqClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(id)) {
      newOpenItems.delete(id);
    } else {
      newOpenItems.add(id);
    }
    setOpenItems(newOpenItems);
  };

  const filteredFaqs = useMemo(() => {
    return FAQ_DATA.filter((item) => {
      const matchesCategory =
        selectedCategory === "all" || item.category === selectedCategory;
      const matchesSearch =
        item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.a.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="flex flex-col gap-8 pb-8">
      {/* Search & Filter Section */}
      <div className="sticky top-4 z-10 flex flex-col gap-4">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-amber-500">
            <Search className="h-5 w-5" />
          </div>
          <input
            type="text"
            placeholder="キーワードで検索（例：位置情報、機種変更）"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-amber-200 bg-white/95 py-3 pl-12 pr-4 text-gray-900 shadow-md shadow-amber-100/50 backdrop-blur-sm transition focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </div>

        {/* Category Chips */}
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {FAQ_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                type="button"
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all",
                  isSelected
                    ? "bg-amber-600 text-white shadow-md shadow-amber-200"
                    : "bg-white text-gray-600 shadow-sm hover:bg-amber-50"
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* FAQ List */}
      <div className="flex flex-col gap-4">
        <AnimatePresence mode="popLayout">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((item) => (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="overflow-hidden rounded-2xl border border-orange-100 bg-white/90 shadow-sm transition-shadow hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className="flex w-full items-start justify-between gap-4 p-5 text-left"
                >
                  <span className="text-[15px] font-bold leading-relaxed text-gray-900">
                    <span className="mr-2 inline-block font-black text-amber-500">Q.</span>
                    {item.q}
                  </span>
                  <div className="mt-1 flex-shrink-0 text-amber-400">
                    {openItems.has(item.id) ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </div>
                </button>
                <AnimatePresence>
                  {openItems.has(item.id) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="border-t border-orange-50 bg-amber-50/30 px-5 pb-5 pt-3">
                        <div className="flex items-start gap-2 text-gray-700">
                          <span className="mt-0.5 font-bold text-amber-600">A.</span>
                          <p className="text-sm leading-relaxed">{item.a}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Search}
                title="条件に一致する質問が見つかりませんでした"
                description="キーワードを変更するか、AIチャットボットにお気軽にご相談ください。"
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("all");
                    }}
                    className="rounded-full bg-amber-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-500"
                  >
                    すべての質問を表示
                  </button>
                }
                secondaryAction={
                  <Link
                    href="/consult"
                    className="rounded-full border border-amber-200 bg-white px-6 py-2.5 text-sm font-bold text-amber-600 shadow-sm transition hover:bg-amber-50"
                  >
                    AIチャットで相談する
                  </Link>
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Still Need Help Section */}
      <div className="mt-4 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-50 p-6 text-center">
        <div className="mb-3 flex justify-center text-amber-600">
          <MessageCircle className="h-8 w-8" />
        </div>
        <h3 className="mb-2 font-bold text-gray-900">解決しませんでしたか？</h3>
        <p className="mb-4 text-sm text-gray-700">
          AIチャットボットがあなたのご質問にお答えします。
          <br />
          お気軽にご相談ください。
        </p>
        <Link
          href="/consult"
          className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-amber-600 shadow-sm transition hover:bg-amber-50 hover:shadow-md"
        >
          <span>チャットで相談する</span>
        </Link>
      </div>
    </div>
  );
}
