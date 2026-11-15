"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin";
import labels from "@/content/site-copy/labels.json";
import { DEFAULT_SITE_COPY } from "@/lib/site-copy/content";
import type { SiteCopy } from "@/lib/site-copy/content";

type History = { id: number; content: SiteCopy; published_at: string; published_by: string | null };
type Data = { draft: SiteCopy; published: SiteCopy; revision: number; history: History[] };

export default function SiteCopyAdminPage() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [copy, setCopy] = useState<SiteCopy | null>(null);
  const [section, setSection] = useState("faq.");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/site-copy", { cache: "no-store" });
      if (!res.ok) throw new Error("文言を読み込めませんでした。データベースの設定を確認してください。");
      const result: Data = await res.json(); setData(result); setCopy(result.draft); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "読み込みに失敗しました"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save(publish: boolean) {
    if (!copy || !data) return;
    if (publish && !window.confirm("この内容をサイトに公開します。よろしいですか？")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const res = await fetch("/api/admin/site-copy", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: copy, revision: data.revision, publish }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "保存できませんでした");
      await load(); setMessage(publish ? "公開しました。" : "下書きを保存しました。"); setPreview(false);
      // 公開後は、この画面から遷移した先でも新しい版が出るよう、レイアウトの文言を読み直す（遷移で文言が古いまま残るのを防ぐ）
      if (publish) router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "保存できませんでした"); }
    finally { setBusy(false); }
  }

  return <AdminLayout><div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <header><h1 className="text-2xl font-bold">サイト文言</h1><p className="mt-2 text-sm text-nicchyo-ink/70">FAQ・紹介ページ・マップ案内の文言を編集できます。保存した下書きは公開されません。</p></header>
    {error && <p role="alert" className="rounded-card bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="rounded-card bg-nicchyo-soft-green p-3 text-sm">{message}</p>}
    {copy && data && <>
      <div className="flex flex-wrap gap-2">{[["faq.","FAQページ"],["about.","紹介ページ"],["mapIntro.","マップ案内"],["faq-items","質問と回答"]].map(([id,label]) => <button key={id} type="button" onClick={() => setSection(id)} aria-pressed={section === id} className={`rounded-btn px-4 py-2 text-sm font-bold ${section === id ? "bg-nicchyo-primary text-white" : "bg-white ring-1 ring-line"}`}>{label}</button>)}</div>
      <p className="text-sm text-nicchyo-ink/70">日本語を変更すると、確認済みの英訳がないため英語ページにも日本語が表示されます。HTMLは使用できません。</p>
      <fieldset disabled={busy} className="space-y-4">
        {section !== "faq-items" ? Object.entries(copy.texts).filter(([key]) => key.startsWith(section)).map(([key,value]) => <label key={key} className="block rounded-card bg-white p-4 ring-1 ring-line"><span className="block text-sm font-bold">{labels[key as keyof typeof labels] ?? key}</span><span className="block break-all text-xs text-nicchyo-ink/60">{key}</span><textarea value={value} onChange={e => setCopy({ ...copy, texts: { ...copy.texts, [key]: e.target.value } })} rows={value.length > 80 ? 4 : 2} className="mt-2 w-full rounded-btn border border-line bg-white p-2 text-sm" /></label>) : copy.faq.map((item,index) => <div key={item.id} className="space-y-2 rounded-card bg-white p-4 ring-1 ring-line"><p className="text-xs text-nicchyo-ink/60">{item.id} / {item.category}</p><label className="block text-sm">質問<input value={item.q} onChange={e => setCopy({ ...copy, faq: copy.faq.map((entry,i) => i === index ? { ...entry, q: e.target.value } : entry) })} className="mt-1 w-full rounded-btn border border-line p-2" /></label><label className="block text-sm">回答<textarea value={item.a} onChange={e => setCopy({ ...copy, faq: copy.faq.map((entry,i) => i === index ? { ...entry, a: e.target.value } : entry) })} rows={4} className="mt-1 w-full rounded-btn border border-line p-2" /></label></div>)}
      </fieldset>
      <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => void save(false)} className="rounded-btn bg-white px-4 py-2 font-bold ring-1 ring-line disabled:opacity-50">下書き保存</button><button type="button" onClick={() => setPreview(!preview)} className="rounded-btn bg-white px-4 py-2 font-bold ring-1 ring-line">公開前の差分を確認</button></div>
      {preview && <section className="space-y-3 rounded-card bg-white p-4 ring-1 ring-line"><h2 className="font-bold">公開前の確認</h2>{Object.entries(copy.texts).filter(([k,v]) => data.published.texts[k as keyof SiteCopy["texts"]] !== v).map(([k,v]) => <div key={k} className="border-t border-line pt-2 text-sm"><p className="text-xs text-nicchyo-ink/60">{k}</p><p>現在：{data.published.texts[k as keyof SiteCopy["texts"]]}</p><p>変更後：{v}</p></div>)}{JSON.stringify(copy.faq) !== JSON.stringify(data.published.faq) && <div className="border-t border-line pt-2 text-sm"><p className="font-bold">質問と回答の変更後</p>{copy.faq.filter((item, index) => JSON.stringify(item) !== JSON.stringify(data.published.faq[index])).map(item => <div key={item.id} className="mt-2 whitespace-pre-line"><p className="font-bold">変更前</p><p>Q. {data.published.faq.find(old => old.id === item.id)?.q ?? "（なし）"}<br />A. {data.published.faq.find(old => old.id === item.id)?.a ?? "（なし）"}</p><p className="mt-1 font-bold">変更後</p><p>Q. {item.q}<br />A. {item.a}</p></div>)}</div>}<button type="button" disabled={busy} onClick={() => void save(true)} className="rounded-btn bg-nicchyo-primary px-4 py-2 font-bold text-white disabled:opacity-50">この内容を公開</button></section>}
      <section className="space-y-2 border-t border-line pt-4"><h2 className="font-bold">公開履歴</h2><button type="button" onClick={() => { setCopy(DEFAULT_SITE_COPY); setMessage("初期値を編集欄に読み込みました。公開するには差分を確認してください。"); }} className="text-sm underline">初期値を読み込む</button>{data.history.length === 0 && <p className="text-sm">公開履歴はまだありません。</p>}{data.history.map(item => <div key={item.id} className="flex flex-wrap items-center gap-3 text-sm"><span>{new Date(item.published_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}（{item.published_by ?? "不明"}）</span><button type="button" onClick={() => { setCopy(item.content); setMessage("過去の版を編集欄に読み込みました。公開するには差分を確認してください。"); }} className="underline">この版を読み込む</button></div>)}</section>
    </>}
  </div></AdminLayout>;
}
