"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Save, CheckCircle2, Loader2, Sparkles, Info } from "lucide-react";

const PLACEHOLDER = `例：
この店の人気商品は芋天です。
揚げたてを提供しているので午前中が一番おいしいです。
10時〜11時ごろは行列ができることがあります。
現金のみの対応です。
試食もできます。`;

const HINTS = [
  "おすすめ商品・こだわり",
  "行列ができやすい時間帯",
  "よく聞かれる質問への回答",
  "決済方法・特記事項",
  "お店の特徴・雰囲気",
];

export default function AiKnowledgePage() {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [hasEmbedding, setHasEmbedding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/vendor/knowledge")
      .then((r) => r.json())
      .then((d: { knowledge?: { content: string; updated_at: string } | null }) => {
        if (d.knowledge) {
          setContent(d.knowledge.content);
          setSavedAt(d.knowledge.updated_at);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  async function handleSave() {
    if (isSaving || !content.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/vendor/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const d = (await res.json()) as { ok?: boolean; hasEmbedding?: boolean; error?: string };
      if (!res.ok) throw new Error(d.error ?? "保存に失敗しました");
      setSavedAt(new Date().toISOString());
      setHasEmbedding(d.hasEmbedding ?? false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFAF0] pb-24">
      {/* ヘッダー */}
      <div className="border-b border-amber-100 bg-white/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href="/my-shop" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-600">AI Knowledge</p>
            <h1 className="text-xl font-bold text-slate-900">AIばあちゃんに教えるお店の情報</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-5">

        <div className="rounded-3xl border border-amber-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Image src="/images/obaasan_transparent.png" alt="AIばあちゃん" width={56} height={56} className="flex-shrink-0 opacity-80" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600">AI Knowledge</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">AIばあちゃんに伝えるお店メモ</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                ここに書いた内容をもとに、お客さんへお店の魅力や注意点をやさしく案内します。
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {["おすすめ商品", "行列ができやすい時間", "決済方法や注意点"].map((item) => (
              <div key={item} className="rounded-2xl bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-800">
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* ヒント */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Info size={14} className="text-slate-400" />
            <p className="text-sm font-semibold text-slate-600">書くと効果的な内容</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {HINTS.map((hint) => (
              <span key={hint} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
                {hint}
              </span>
            ))}
          </div>
        </div>

        {/* 入力フォーム */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-base font-semibold text-slate-700">店舗説明</p>
            {savedAt && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <CheckCircle2 size={10} className="text-emerald-500" />
                {new Date(savedAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} 保存済み
                {hasEmbedding && <span className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] text-violet-600">AI学習済み</span>}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-amber-500" />
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={12}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base leading-relaxed text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
            />
          )}

          <p className="mt-2 text-xs text-slate-400">
            {content.length} 文字 ／ 自由な文章で入力できます
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* 保存ボタン */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !content.trim()}
          className={`flex w-full items-center justify-center gap-2 rounded-3xl py-4 text-base font-bold shadow transition ${
            isSaving
              ? "cursor-not-allowed bg-slate-200 text-slate-400"
              : "bg-amber-500 text-white hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          }`}
        >
          {isSaving
            ? <><Loader2 size={18} className="animate-spin" />AIに学習させています...</>
            : <><Sparkles size={18} />AIばあちゃんに教える</>
          }
        </button>

        {/* 仕組み説明 */}
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Save size={13} className="text-slate-400" />
            <p className="text-sm font-semibold text-slate-600">保存後の動き</p>
          </div>
          <ul className="space-y-1.5 text-sm text-slate-500">
            <li>・書いた内容をAIばあちゃんが案内に使います</li>
            <li>・あとから何度でも書き直せます</li>
            <li>・短いメモでも問題ありません</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
