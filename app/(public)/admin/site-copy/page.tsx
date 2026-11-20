"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin";
import labels from "@/content/site-copy/labels.json";
import enTexts from "@/content/i18n/en.json";
import { DEFAULT_SITE_COPY } from "@/lib/site-copy/content";
import type { SiteCopy, SiteCopyKey } from "@/lib/site-copy/content";
import { chunkSiteCopyItems } from "@/lib/site-copy/translate";

type History = { id: number; content: SiteCopy; published_at: string; published_by: string | null };
type Data = { draft: SiteCopy; published: SiteCopy; revision: number; history: History[] };
type Lang = "ja" | "en";

const SECTIONS: [string, string][] = [["faq.", "FAQページ"], ["about.", "紹介ページ"], ["mapIntro.", "マップ案内"], ["landing.", "トップページ"], ["support.", "協賛・ご支援"], ["supporters.", "支援者一覧"], ["story.", "近況"], ["faq-items", "質問と回答"]];
const TEXT_SECTIONS = SECTIONS.filter(([id]) => id !== "faq-items");

/** 英訳の欄の値。空欄は英訳を消す（来訪者には、初期の英訳があればそれ、無ければ日本語が出る） */
function setEnglish(copy: SiteCopy, key: SiteCopyKey, value: string): SiteCopy {
  const texts = { ...(copy.en?.texts ?? {}) };
  if (value.trim() === "") delete texts[key];
  else texts[key] = { text: value, source: copy.texts[key] };
  return { ...copy, en: { texts } };
}

export default function SiteCopyAdminPage() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [copy, setCopy] = useState<SiteCopy | null>(null);
  const [section, setSection] = useState("faq.");
  const [lang, setLang] = useState<Lang>("ja");
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

  /** 選んだ区分の日本語を、AI で英訳して英語の欄に入れる。保存はしない（確認・直してから保存する） */
  async function translateSection() {
    if (!copy) return;
    const items = Object.entries(copy.texts)
      .filter(([key, value]) => key.startsWith(section) && value.trim() !== "")
      .map(([key, text]) => ({ key, text }));
    if (items.length === 0) return;
    setBusy(true); setError(""); setMessage("");
    let next = copy;
    let count = 0;
    try {
      // 件数・文字数の上限に合わせて分けて送る（区分によっては上限を超えるため）
      for (const chunk of chunkSiteCopyItems(items)) {
        const res = await fetch("/api/admin/site-copy/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: chunk }) });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error ?? "翻訳できませんでした");
        const translations = result.translations as Record<string, string>;
        for (const [key, text] of Object.entries(translations)) next = setEnglish(next, key as SiteCopyKey, text);
        count += Object.keys(translations).length;
      }
      setMessage(`${count}件の英訳案を入れました。確認して直してから、下書き保存または公開してください。`);
    } catch (e) { setError(e instanceof Error ? e.message : "翻訳できませんでした"); }
    finally { setCopy(next); setBusy(false); }
  }

  const sectionKeys = copy ? Object.keys(copy.texts).filter((key) => key.startsWith(section)) : [];
  const englishChanged = (key: SiteCopyKey) => JSON.stringify(copy?.en?.texts[key]) !== JSON.stringify(data?.published.en?.texts[key]);

  return <AdminLayout><div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <header><h1 className="text-2xl font-bold">サイト文言</h1><p className="mt-2 text-sm text-nicchyo-ink/70">FAQ・紹介ページ・マップ案内・トップページの文言を編集できます。保存した下書きは公開されません。</p></header>
    {error && <p role="alert" className="rounded-card bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="rounded-card bg-nicchyo-soft-green p-3 text-sm">{message}</p>}
    {copy && data && <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="編集する言語">
        {(["ja", "en"] as Lang[]).map((code) => <button key={code} type="button" onClick={() => { setLang(code); if (code === "en" && section === "faq-items") setSection("faq."); }} aria-pressed={lang === code} className={`rounded-btn px-4 py-2 text-sm font-bold ${lang === code ? "bg-nicchyo-ink text-white" : "bg-white ring-1 ring-line"}`}>{code === "ja" ? "日本語" : "English"}</button>)}
      </div>
      <div className="flex flex-wrap gap-2">{(lang === "ja" ? SECTIONS : TEXT_SECTIONS).map(([id, label]) => <button key={id} type="button" onClick={() => setSection(id)} aria-pressed={section === id} className={`rounded-btn px-4 py-2 text-sm font-bold ${section === id ? "bg-nicchyo-primary text-white" : "bg-white ring-1 ring-line"}`}>{label}</button>)}</div>
      {lang === "ja" ? <p className="text-sm text-nicchyo-ink/70">日本語を変更すると、その英訳は使われず英語ページにも日本語が表示されます。英語の欄で英訳を直すと、英語に戻ります。HTMLは使用できません。</p>
        : <p className="text-sm text-nicchyo-ink/70">英語の欄は、英訳を書いたときの日本語と一緒に保存されます。日本語を変えたあとに英訳を直さないと、その文言は日本語のまま表示されます。空欄は初期の英訳（あれば）か日本語を表示します。質問と回答の英訳は今後の対応です。</p>}
      {lang === "en" && <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={busy} onClick={() => void translateSection()} className="rounded-btn bg-nicchyo-accent px-4 py-2 text-sm font-bold disabled:opacity-50">この区分の日本語をAIで英訳</button><span className="text-xs text-nicchyo-ink/70">英訳は入力欄に入るだけで、保存されません。</span></div>}
      <fieldset disabled={busy} className="space-y-4">
        {lang === "ja" && section !== "faq-items" && sectionKeys.map((key) => <label key={key} className="block rounded-card bg-white p-4 ring-1 ring-line"><span className="block text-sm font-bold">{labels[key as keyof typeof labels] ?? key}</span><span className="block break-all text-xs text-nicchyo-ink/60">{key}</span><textarea value={copy.texts[key as SiteCopyKey]} onChange={e => setCopy({ ...copy, texts: { ...copy.texts, [key]: e.target.value } })} rows={copy.texts[key as SiteCopyKey].length > 80 ? 4 : 2} className="mt-2 w-full rounded-btn border border-line bg-white p-2 text-sm" /></label>)}
        {lang === "en" && sectionKeys.map((key) => {
          const k = key as SiteCopyKey;
          const entry = copy.en?.texts[k];
          const stale = !!entry && entry.source !== copy.texts[k];
          return <label key={key} className="block rounded-card bg-white p-4 ring-1 ring-line">
            <span className="block text-sm font-bold">{labels[k as keyof typeof labels] ?? key}</span>
            <span className="block break-all text-xs text-nicchyo-ink/60">{key}</span>
            <span className="mt-2 block rounded-btn bg-nicchyo-base p-2 text-xs text-nicchyo-ink/80">日本語：{copy.texts[k] || "（空欄）"}</span>
            {stale && <span className="mt-2 block text-xs font-bold text-rose-700">日本語を変更したため、この英訳は使われていません（英語ページは日本語）。英訳を直してください。</span>}
            <textarea value={entry?.text ?? ""} placeholder={enTexts[key as keyof typeof enTexts] ?? "（英訳なし：日本語を表示）"} onChange={e => setCopy(setEnglish(copy, k, e.target.value))} rows={copy.texts[k].length > 80 ? 4 : 2} className="mt-2 w-full rounded-btn border border-line bg-white p-2 text-sm" />
          </label>;
        })}
        {lang === "ja" && section === "faq-items" && copy.faq.map((item,index) => <div key={item.id} className="space-y-2 rounded-card bg-white p-4 ring-1 ring-line"><p className="text-xs text-nicchyo-ink/60">{item.id} / {item.category}</p><label className="block text-sm">質問<input value={item.q} onChange={e => setCopy({ ...copy, faq: copy.faq.map((entry,i) => i === index ? { ...entry, q: e.target.value } : entry) })} className="mt-1 w-full rounded-btn border border-line p-2" /></label><label className="block text-sm">回答<textarea value={item.a} onChange={e => setCopy({ ...copy, faq: copy.faq.map((entry,i) => i === index ? { ...entry, a: e.target.value } : entry) })} rows={4} className="mt-1 w-full rounded-btn border border-line p-2" /></label></div>)}
      </fieldset>
      <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => void save(false)} className="rounded-btn bg-white px-4 py-2 font-bold ring-1 ring-line disabled:opacity-50">下書き保存</button><button type="button" onClick={() => setPreview(!preview)} className="rounded-btn bg-white px-4 py-2 font-bold ring-1 ring-line">公開前の差分を確認</button></div>
      {preview && <section className="space-y-3 rounded-card bg-white p-4 ring-1 ring-line"><h2 className="font-bold">公開前の確認</h2>{Object.entries(copy.texts).filter(([k,v]) => data.published.texts[k as SiteCopyKey] !== v).map(([k,v]) => <div key={k} className="border-t border-line pt-2 text-sm"><p className="text-xs text-nicchyo-ink/60">{k}</p><p>現在：{data.published.texts[k as SiteCopyKey]}</p><p>変更後：{v}</p></div>)}{(Object.keys(copy.texts) as SiteCopyKey[]).filter(englishChanged).map(k => <div key={`en-${k}`} className="border-t border-line pt-2 text-sm"><p className="text-xs text-nicchyo-ink/60">{k}（English）</p><p>現在：{data.published.en?.texts[k]?.text ?? "（英訳なし）"}</p><p>変更後：{copy.en?.texts[k]?.text ?? "（英訳なし）"}</p></div>)}{JSON.stringify(copy.faq) !== JSON.stringify(data.published.faq) && <div className="border-t border-line pt-2 text-sm"><p className="font-bold">質問と回答の変更後</p>{copy.faq.filter((item, index) => JSON.stringify(item) !== JSON.stringify(data.published.faq[index])).map(item => <div key={item.id} className="mt-2 whitespace-pre-line"><p className="font-bold">変更前</p><p>Q. {data.published.faq.find(old => old.id === item.id)?.q ?? "（なし）"}<br />A. {data.published.faq.find(old => old.id === item.id)?.a ?? "（なし）"}</p><p className="mt-1 font-bold">変更後</p><p>Q. {item.q}<br />A. {item.a}</p></div>)}</div>}<button type="button" disabled={busy} onClick={() => void save(true)} className="rounded-btn bg-nicchyo-primary px-4 py-2 font-bold text-white disabled:opacity-50">この内容を公開</button></section>}
      <section className="space-y-2 border-t border-line pt-4"><h2 className="font-bold">公開履歴</h2><button type="button" onClick={() => { setCopy({ ...DEFAULT_SITE_COPY, en: copy.en }); setMessage("初期値を編集欄に読み込みました（英訳は残しています）。公開するには差分を確認してください。"); }} className="text-sm underline">初期値を読み込む</button>{data.history.length === 0 && <p className="text-sm">公開履歴はまだありません。</p>}{data.history.map(item => <div key={item.id} className="flex flex-wrap items-center gap-3 text-sm"><span>{new Date(item.published_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}（{item.published_by ?? "不明"}）</span><button type="button" onClick={() => { setCopy(item.content); setMessage("過去の版を編集欄に読み込みました。公開するには差分を確認してください。"); }} className="underline">この版を読み込む</button></div>)}</section>
    </>}
  </div></AdminLayout>;
}
