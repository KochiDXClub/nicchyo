"use client";

import { Badge } from "@/components/ui";
import { Card, buttonClass, inputClass } from "./fieldFormParts";

/** 画面で編集する英語版。店名は「読み（ローマ字）」。空文字は「その項目は訳さない」 */
export type EnglishDraft = {
  name: string;
  strength: string;
  style: string;
  /** { 日本語の商品名: 英語名 } */
  products: Record<string, string>;
};

export const EMPTY_ENGLISH: EnglishDraft = { name: "", strength: "", style: "", products: {} };

/** 英語版が空か（どの項目も入っていない） */
export function isEnglishEmpty(draft: EnglishDraft | null): boolean {
  if (!draft) return true;
  return !draft.name.trim() && !draft.strength.trim() && !draft.style.trim() && Object.values(draft.products).every((v) => !v.trim());
}

type Props = {
  /** いま入力中の日本語（英語欄の見出しに並べて出す） */
  source: { name: string; strength: string; style: string };
  productNames: string[];
  draft: EnglishDraft | null;
  /** auto = AI訳のまま、reviewed = 手直し・確認済み、null = 英語版なし */
  status: "auto" | "reviewed" | null;
  /** none = 英語版なし、fresh = 日本語に合っている、stale = 訳したあとに日本語を変えた */
  state: "none" | "fresh" | "stale";
  translating: boolean;
  canTranslate: boolean;
  onTranslate: () => void;
  onChange: (draft: EnglishDraft) => void;
  onClear: () => void;
  onConfirmFresh: () => void;
};

/**
 * 現場登録の「英語版」。日本語を入れたあと、AI の訳を見て、直してから、日本語と一緒に保存する。
 * 保存するまで、来訪者には何も出ない。保存した英語版は「確認済み」として扱い、自動の翻訳で上書きしない。
 */
export function FieldEnglishCard({ source, productNames, draft, status, state, translating, canTranslate, onTranslate, onChange, onClear, onConfirmFresh }: Props) {
  const current = draft ?? EMPTY_ENGLISH;
  const set = (patch: Partial<EnglishDraft>) => onChange({ ...current, ...patch });

  return (
    <Card
      title="英語版（AI翻訳 → 確認）"
      hint="日本語を入れたら、英語に翻訳して確認できます。直したいところは直してから、下の「内容を保存」で日本語と一緒に保存します。"
    >
      {state === "none" ? (
        <div className="space-y-2 rounded-lg bg-amber-50/60 p-3 text-[13px] leading-relaxed text-nicchyo-ink/70">
          <p>英語版を作らずに保存すると、あとで自動の翻訳が（確認なしで）英語版を作ります。ここで確認して保存すると、その英語版が使われ、自動では上書きされません。</p>
          <button type="button" onClick={onTranslate} disabled={!canTranslate || translating} className={`${buttonClass} w-full border border-amber-500 bg-white text-amber-700`}>
            {translating ? "翻訳しています…" : "AIで英語に翻訳する"}
          </button>
          {!canTranslate ? <p className="text-[12px] text-nicchyo-ink/55">店名などの日本語を入れると押せます。</p> : null}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {status ? <Badge variant={status === "auto" ? "info" : "amber"}>{status === "auto" ? "AI翻訳のまま（未確認）" : "手直し済み"}</Badge> : null}
            {state === "fresh" && status === "auto" ? <span className="text-[13px] text-nicchyo-ink/70">AIが訳した下書きです。内容を確かめてから保存してください。</span> : null}
          </div>
          {state === "stale" ? (
            <div role="alert" className="space-y-2 rounded-lg bg-rose-50 p-3 text-[13px] leading-relaxed text-rose-700">
              <p>日本語を変更しました。英語版は変更前の内容のままです（来訪者には、日本語に合っていない英語は出ません）。「もう一度翻訳」で作り直すか、英語を直して「日本語に合っています」を押してください。</p>
              <button type="button" onClick={onConfirmFresh} disabled={translating} className={`${buttonClass} w-full border border-rose-300 bg-white text-rose-700`}>
                英語版は日本語に合っています
              </button>
            </div>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-nicchyo-ink/70">店名の読み（ローマ字）　<span lang="ja" className="font-normal">{source.name}</span></span>
            <input lang="en" value={current.name} onChange={(e) => set({ name: e.target.value })} maxLength={300} disabled={translating} className={inputClass} />
          </label>
          <p className="-mt-2 text-[12px] text-nicchyo-ink/55">店名は訳さず、読みを足して「Romaji (日本語)」で出します。看板と見比べられるようにするためです。</p>
          {source.strength.trim() ? (
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-nicchyo-ink/70">こだわり・ひとこと　<span lang="ja" className="font-normal">{source.strength.slice(0, 30)}{source.strength.length > 30 ? "…" : ""}</span></span>
              <textarea lang="en" value={current.strength} onChange={(e) => set({ strength: e.target.value })} rows={3} maxLength={600} disabled={translating} className={inputClass} />
            </label>
          ) : null}
          {source.style.trim() ? (
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-nicchyo-ink/70">出店スタイル　<span lang="ja" className="font-normal">{source.style.slice(0, 30)}{source.style.length > 30 ? "…" : ""}</span></span>
              <input lang="en" value={current.style} onChange={(e) => set({ style: e.target.value })} maxLength={600} disabled={translating} className={inputClass} />
            </label>
          ) : null}
          {productNames.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-[13px] font-medium text-nicchyo-ink/70">商品名</legend>
              {productNames.map((name) => (
                <div key={name} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-2">
                  <span lang="ja" className="truncate text-sm text-nicchyo-ink/80">{name}</span>
                  <input
                    lang="en"
                    aria-label={`${name}の英語名`}
                    value={current.products[name] ?? ""}
                    onChange={(e) => set({ products: { ...current.products, [name]: e.target.value } })}
                    maxLength={200}
                    disabled={translating}
                    className={inputClass}
                  />
                </div>
              ))}
            </fieldset>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onTranslate} disabled={!canTranslate || translating} className={`${buttonClass} border border-amber-500 bg-white text-amber-700`}>
              {translating ? "翻訳しています…" : "もう一度翻訳"}
            </button>
            <button type="button" onClick={onClear} disabled={translating} className={`${buttonClass} border border-line bg-white text-nicchyo-ink/70`}>
              英語版を消す
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
