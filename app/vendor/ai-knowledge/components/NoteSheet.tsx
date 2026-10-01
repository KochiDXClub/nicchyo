"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import VendorSheet from "@/components/vendor/VendorSheet";
import { cn } from "@/lib/utils/cn";
import {
  NOTE_CONTENT_MAX,
  NOTE_TITLE_MAX,
  NOTE_TITLE_SUGGESTIONS,
  type AiNote,
  type AiNoteInput,
} from "@/lib/vendor/aiNotes";

/** トピックタイトルの候補ごとの、本文の書き出しの例 */
const CONTENT_PLACEHOLDERS: Record<string, string> = {
  おすすめ: "例：一番人気は芋天。揚げたてを出しちょります。午前中が一番おいしいき、早めに来てや。",
  混む時間: "例：10時〜11時は10分くらい待つことがあります。お昼前は空いちょります。",
  お支払い方法: "例：現金だけです。PayPay やカードは使えません。小銭があると助かります。",
  試食: "例：たいていの商品は試食できるき、気軽に声をかけてください。",
  気をつけること: "例：雨がひどい日は11時ごろに店じまいすることがあります。",
};
const DEFAULT_CONTENT_PLACEHOLDER = "例：お客さんによく聞かれることや、知っておいてほしいことを書いてや。";

/**
 * にちよさんが覚えていることを1つ直す・自分で書いて覚えさせるシート。
 * 画面の下から上がってくる（外枠は VendorSheet）。
 */
export default function NoteSheet({
  note,
  saving,
  error,
  onClose,
  onSave,
  onDelete,
}: {
  /** 直す覚えごと。新しく書くときは null */
  note: AiNote | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: AiNoteInput) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [forVisitors, setForVisitors] = useState(note?.forVisitors ?? true);
  const [forVendor, setForVendor] = useState(note?.forVendor ?? true);
  /** 「消す」を一度押したあと（誤って消さないよう、もう一度確かめる） */
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const noAudience = !forVisitors && !forVendor;
  const canSave = title.trim().length > 0 && content.trim().length > 0 && !noAudience && !saving;
  const contentPlaceholder = CONTENT_PLACEHOLDERS[title.trim()] ?? DEFAULT_CONTENT_PLACEHOLDER;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    onSave({ title: title.trim(), content: content.trim(), forVisitors, forVendor });
  }

  return (
    <VendorSheet labelledBy="note-sheet-title" busy={saving} onClose={onClose}>
        <form onSubmit={handleSubmit} className="space-y-5 px-5 pt-4" aria-busy={saving}>
          <h2 id="note-sheet-title" className="text-xl font-bold text-nicchyo-ink">
            {note ? "覚えちゅうことを直す" : "自分で書いて覚えさせる"}
          </h2>

          <div>
            <label htmlFor="note-title" className="mb-1.5 block text-sm font-semibold text-nicchyo-ink/70">
              トピックタイトル
            </label>
            <input
              id="note-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={NOTE_TITLE_MAX}
              placeholder="例：混む時間"
              className="w-full rounded-btn bg-white px-4 py-3 text-base font-semibold text-nicchyo-ink outline-none ring-1 ring-line placeholder:font-normal placeholder:text-nicchyo-ink/40 focus:ring-2 focus:ring-amber-400"
            />
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="トピックタイトルの候補">
              {NOTE_TITLE_SUGGESTIONS.map((suggestion) => {
                const selected = title.trim() === suggestion;
                return (
                  <button
                    key={suggestion}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTitle(suggestion)}
                    className={cn(
                      "h-9 rounded-chip px-3.5 text-sm font-semibold transition",
                      selected
                        ? "bg-nicchyo-ink text-white shadow-chip"
                        : "bg-white text-nicchyo-ink/70 ring-1 ring-line hover:bg-nicchyo-base"
                    )}
                  >
                    {suggestion}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-nicchyo-ink/70">覚えること</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={NOTE_CONTENT_MAX}
              rows={5}
              placeholder={contentPlaceholder}
              className="w-full resize-none rounded-btn bg-white px-4 py-3 text-base leading-relaxed text-nicchyo-ink outline-none ring-1 ring-line placeholder:text-nicchyo-ink/40 focus:ring-2 focus:ring-amber-400"
            />
            {content.length > NOTE_CONTENT_MAX * 0.9 && (
              <span className="mt-1 block text-right text-xs text-nicchyo-ink/55">
                {content.length} / {NOTE_CONTENT_MAX}
              </span>
            )}
          </label>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-nicchyo-ink/70">どこで使う？</legend>
            <div className="space-y-2">
              <AudienceSwitch
                label="お客さんへの案内"
                hint="お客さんの相談や、お店のページのチャットで、にちよさんが答えに使う"
                checked={forVisitors}
                onChange={setForVisitors}
              />
              <AudienceSwitch
                label="自分の相談"
                hint="出店者トップでにちよさんに相談したときに使う"
                checked={forVendor}
                onChange={setForVendor}
              />
            </div>
            {noAudience && (
              <p className="mt-2 text-sm text-amber-800">どちらか1つは選んでください</p>
            )}
          </fieldset>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-btn bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button type="submit" size="lg" disabled={!canSave}>
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                  覚えさせています…
                </>
              ) : (
                "これで覚えちょいて"
              )}
            </Button>
            <Button variant="quiet" size="lg" onClick={onClose} disabled={saving}>
              閉じる
            </Button>
          </div>

          {note && (
            <div className="flex items-center justify-center gap-3 pb-1 text-sm">
              {confirmingDelete ? (
                <span className="flex items-center gap-3" role="group" aria-label="忘れさせてよいか">
                  <span className="font-semibold text-nicchyo-ink/70">ほんまに忘れさせる？</span>
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={saving}
                    className="font-bold text-rose-600 underline underline-offset-2 disabled:opacity-50"
                  >
                    忘れさせる
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={saving}
                    className="font-semibold text-nicchyo-ink/60 underline underline-offset-2 disabled:opacity-50"
                  >
                    やめる
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={saving}
                  className="font-semibold text-rose-600 underline underline-offset-2 disabled:opacity-50"
                >
                  にちよさんに忘れさせる
                </button>
              )}
            </div>
          )}
        </form>
    </VendorSheet>
  );
}

/** オン・オフのスイッチ（届け先・渡すものの設定で使う） */
export function AudienceSwitch({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-btn bg-white px-4 py-3 text-left ring-1 ring-line transition hover:bg-nicchyo-base disabled:opacity-60"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-nicchyo-ink">{label}</span>
        <span className="block text-sm text-nicchyo-ink/55">{hint}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-chip transition-colors",
          checked ? "bg-amber-500" : "bg-nicchyo-ink/20"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-6 w-6 rounded-chip bg-white shadow-chip transition-transform",
            checked ? "translate-x-[1.375rem]" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}
