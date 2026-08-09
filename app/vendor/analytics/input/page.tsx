"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { fetchTodayProductSales, saveTodayProductSales } from "../../_services/analyticsService";
import type { ProductSale } from "../../_types";
import { ArrowLeft, Plus, Trash2, Save, CheckCircle2, ShoppingBag, Loader2, AlertCircle } from "lucide-react";
import { CenteredLoading } from "@/components/ui/loading-spinner";
import { EmptyMessage } from "@/components/ui/empty-message";

export default function SalesInputPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Pick<ProductSale, "product_name" | "quantity">[]>([]);
  const [name, setName]       = useState("");
  const [qty, setQty]         = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving]   = useState(false);
  const [isSaved, setIsSaved]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchTodayProductSales(user.id)
      .then((data) => setEntries(data.map((d) => ({ product_name: d.product_name, quantity: d.quantity }))))
      .catch(() => setError("データの読み込みに失敗しました"))
      .finally(() => setIsLoading(false));
  }, [user]);

  function addEntry() {
    const trimmed = name.trim();
    const q = parseInt(qty, 10);
    if (!trimmed || isNaN(q) || q <= 0) return;
    setEntries((prev) => {
      const existing = prev.findIndex((e) => e.product_name === trimmed);
      if (existing >= 0) {
        return prev.map((e, i) => (i === existing ? { ...e, quantity: e.quantity + q } : e));
      }
      return [...prev, { product_name: trimmed, quantity: q }];
    });
    setName("");
    setQty("");
  }

  function removeEntry(productName: string) {
    setEntries((prev) => prev.filter((e) => e.product_name !== productName));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSaving || !user) return;
    setIsSaving(true);
    setError(null);
    try {
      await saveTodayProductSales(user.id, entries);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch {
      setError("保存に失敗しました。もう一度お試しください。");
    } finally {
      setIsSaving(false);
    }
  }

  const today = new Date().toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });

  return (
    <div className="min-h-screen bg-[#FFFAF0] pb-24">
      <div className="border-b border-amber-100 bg-white/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href="/vendor/analytics" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-600">Sales Input</p>
            <h1 className="text-xl font-bold text-slate-900">販売数量を入力</h1>
          </div>
          <span className="ml-auto rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">{today}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4 px-4 pt-5">

        <div className="rounded-3xl border border-amber-100 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600">Sales Input</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">販売数量を入力</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            1件ずつ追加しておくと、売れた商品が後から見やすくなります。
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle size={14} />{error}
          </div>
        )}

        {/* 入力フォーム */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <Plus size={14} />
            </div>
            <h2 className="text-base font-semibold text-slate-700">商品を追加</h2>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_auto]">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEntry(); } }}
              placeholder="商品名（例：芋天）"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none focus:ring-2 focus:ring-amber-300"
            />
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEntry(); } }}
              placeholder="数量" min={1}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none focus:ring-2 focus:ring-amber-300"
            />
            <button type="button" onClick={addEntry}
              className="flex items-center justify-center gap-1 rounded-2xl bg-emerald-500 px-3 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
            >
              <Plus size={14} />追加
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">同じ商品名を入力すると数量が加算されます</p>
        </div>

        {/* 入力済み一覧 */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <ShoppingBag size={14} />
            </div>
            <h2 className="text-base font-semibold text-slate-700">本日の販売記録</h2>
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {entries.length} 商品
            </span>
          </div>

          {isLoading ? (
            <CenteredLoading size={22} padding="py-6" />
          ) : entries.length === 0 ? (
            <EmptyMessage message="商品を追加してください" padding="py-6" />
          ) : (
            <div className="space-y-2">
              {[...entries].sort((a, b) => b.quantity - a.quantity).map((entry) => {
                const maxQty = Math.max(...entries.map((e) => e.quantity));
                const pct = Math.round((entry.quantity / maxQty) * 100);
                return (
                  <div key={entry.product_name} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">{entry.product_name}</span>
                        <span className="text-sm font-bold text-amber-600">{entry.quantity} 個</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-amber-100">
                        <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <button type="button" onClick={() => removeEntry(entry.product_name)}
                      className="flex-shrink-0 text-slate-300 transition hover:text-rose-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 保存ボタン */}
        <button type="submit" disabled={isSaving || entries.length === 0}
          className={`flex w-full items-center justify-center gap-2 rounded-3xl py-4 text-base font-bold shadow transition ${
            isSaving ? "cursor-not-allowed bg-slate-200 text-slate-400"
            : isSaved  ? "bg-emerald-500 text-white"
            : entries.length === 0 ? "cursor-not-allowed bg-slate-100 text-slate-300"
            : "bg-amber-500 text-white hover:bg-amber-400"
          }`}
        >
          {isSaving ? <><Loader2 size={18} className="animate-spin" />保存中...</>
          : isSaved  ? <><CheckCircle2 size={18} />保存しました！</>
          : <><Save size={18} />販売データを保存する</>}
        </button>

      </form>
    </div>
  );
}
