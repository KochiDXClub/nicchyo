"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import VendorSheet from "@/components/vendor/VendorSheet";
import { cn } from "@/lib/utils/cn";
import {
  NOTE_CONTENT_MAX,
  NOTE_TITLE_MAX,
  NOTE_TOPICS,
  type AiNote,
  type AiNoteInput,
  type NoteTopic,
} from "@/lib/vendor/aiNotes";

/** 話題ごとの、タイトルと詳しくの書き出しの例 */
const PLACEHOLDERS: Record<NoteTopic, { title: string; content: string }> = {
  recommend: { title: "例：一番人気は芋天", content: "例：揚げたてを出しちょります。午前中が一番おいしいき、早めに来てや。" },
  busy: { title: "例：10時〜11時は並びます", content: "例：この時間は10分くらい待つことがあります。お昼前は空いちょります。" },
  payment: { title: "例：現金だけです", content: "例：PayPay やカードは使えません。小銭があると助かります。" },
  caution: { title: "例：雨の日は早じまい", content: "例：雨がひどい日は11時ごろに店じまいすることがあります。" },
  other: { title: "例：試食できます", content: "例：たいていの商品は試食できるき、気軽に声をかけてください。" },
};

/**
 * ノートを1枚書く・直すシート。画面の下から上がってくる（外枠は VendorSheet）。
 */
export default function NoteSheet({
  note,
  saving,
  error,
  onClose,
  onSave,
  onDelete,
}: {
  /** 直すノート。新しく書くときは null */
  note: AiNote | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: AiNoteInput) => void;
  onDelete: () => void;
}) {
  const [topic, setTopic] = useState<NoteTopic>(note?.topic ?? "recommend");
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [forVisitors, setForVisitors] = useState(note?.forVisitors ?? true);
  const [forVendor, setForVendor] = useState(note?.forVendor ?? true);
  /** 「消す」を一度押したあと（誤って消さないよう、もう一度確かめる） */
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const noAudience = !forVisitors && !forVendor;
  const canSave = title.trim().length > 0 && content.trim().length > 0 && !noAudience && !saving;
  const placeholder = PLACEHOLDERS[topic];

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    onSave({ topic, title: title.trim(), content: content.trim(), forVisitors, forVendor });
  }

  return (
    <VendorSheet labelledBy="note-sheet-title" busy={saving} onClose={onClose}>
        <form onSubmit={handleSubmit} className="space-y-5 px-5 pt-4" aria-busy={saving}>
          <h2 id="note-sheet-title" className="text-xl font-bold text-nicchyo-ink">
            {note ? "ノートを直す" : "ノートを書く"}
          </h2>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-nicchyo-ink/70">話題</legend>
            <div className="flex flex-wrap gap-2">
              {NOTE_TOPICS.map((option) => {
                const selected = topic === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTopic(option.id)}
                    className={cn(
                      "h-10 rounded-chip px-4 text-sm font-semibold transition",
                      selected
                        ? "bg-nicchyo-ink text-white shadow-chip"
                        : "bg-white text-nicchyo-ink/70 ring-1 ring-line hover:bg-nicchyo-base"
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-nicchyo-ink/70">タイトル（ひとことで）</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={NOTE_TITLE_MAX}
              placeholder={placeholder.title}
              className="w-full rounded-btn bg-white px-4 py-3 text-base font-semibold text-nicchyo-ink outline-none ring-1 ring-line placeholder:font-normal placeholder:text-nicchyo-ink/40 focus:ring-2 focus:ring-amber-400"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-nicchyo-ink/70">詳しく</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={NOTE_CONTENT_MAX}
              rows={5}
              placeholder={placeholder.content}
              className="w-full resize-none rounded-btn bg-white px-4 py-3 text-base leading-relaxed text-nicchyo-ink outline-none ring-1 ring-line placeholder:text-nicchyo-ink/40 focus:ring-2 focus:ring-amber-400"
            />
            {content.length > NOTE_CONTENT_MAX * 0.9 && (
              <span className="mt-1 block text-right text-xs text-nicchyo-ink/55">
                {content.length} / {NOTE_CONTENT_MAX}
              </span>
            )}
          </label>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-nicchyo-ink/70">どのにちよさんに教える？</legend>
            <div className="space-y-2">
              <AudienceSwitch
                label="お客さんのにちよさん"
                hint="お客さんの相談や、お店のページのチャットで答えに使う"
                checked={forVisitors}
                onChange={setForVisitors}
              />
              <AudienceSwitch
                label="自分の相談のにちよさん"
                hint="使い方やお店の相談をしたときに使う"
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
                  教えています…
                </>
              ) : (
                "にちよさんに教える"
              )}
            </Button>
            <Button variant="quiet" size="lg" onClick={onClose} disabled={saving}>
              閉じる
            </Button>
          </div>

          {note && (
            <div className="flex items-center justify-center gap-3 pb-1 text-sm">
              {confirmingDelete ? (
                <span className="flex items-center gap-3" role="group" aria-label="このノートを消してよいか">
                  <span className="font-semibold text-nicchyo-ink/70">ほんまに消す？</span>
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={saving}
                    className="font-bold text-rose-600 underline underline-offset-2 disabled:opacity-50"
                  >
                    消す
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
                  このノートを消す
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
