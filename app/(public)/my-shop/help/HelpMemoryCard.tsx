"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { AskForm, SkipLabelContext, fieldClass } from "@/components/vendor/ask/askFormParts";
import { NOTE_CONTENT_MAX, NOTE_TITLE_MAX } from "@/lib/vendor/aiNotes";
import { memoryHasContact, type HelpMemoryNote } from "@/lib/vendor/helpProposals";
import { AiNotesError, createAiNote } from "@/app/vendor/_services/aiNotesService";

type Props = {
  note: HelpMemoryNote;
  onSaved: (line: string) => void;
  onDismiss: (line: string) => void;
};

const SAVE_ERROR = "うまく覚えられんかった。もういっぺんやってみてや。";

/**
 * にちよさんの「覚えちょいてもかまん？」。
 *
 * 相談の中で出店者が話した、来訪者に伝えるとよいことを、にちよさんがノートにしてよいか聞く。
 * トピックタイトルと本文はその場で直せる。覚えたことは、お客さんへの案内と、
 * この相談の両方で使う（どちらに使うかは「にちよさんが覚えちゅうこと」で変えられる）。
 */
export default function HelpMemoryCard({ note, onSaved, onDismiss }: Props) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await createAiNote({ title: title.trim(), content: content.trim(), forVisitors: true, forVendor: true });
      onSaved("覚えちょくね！お客さんに聞かれたら伝えるき。");
    } catch (err) {
      setError(err instanceof AiNotesError ? err.message : SAVE_ERROR);
      setSaving(false);
    }
  };

  return (
    <div
      role="group"
      aria-label="にちよさんが覚えることの確認"
      className="mt-4 rounded-card border border-amber-200 bg-nicchyo-base px-4 py-4"
    >
      <p className="text-sm font-bold text-amber-900">
        これ、覚えちょいてもかまん？
        <span className="block text-xs font-normal text-amber-900/70">
          お客さんに聞かれたときの案内に使うで。直してから覚えさせてもかまんきね。
        </span>
      </p>

      {memoryHasContact({ title, content }) && (
        <p className="mt-2 text-xs font-semibold leading-relaxed text-amber-800">
          リンクや電話番号がお客さんに伝わるで。合うちゅうか確かめてや。
        </p>
      )}

      <div className="mt-3">
        <SkipLabelContext.Provider value="いらん">
          <AskForm
            canSubmit={title.trim() !== "" && content.trim() !== ""}
            saving={saving}
            onSubmit={() => void save()}
            onSkip={() => onDismiss("わかった、覚えんちょくね。")}
          >
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={NOTE_TITLE_MAX}
              aria-label="何の話か（トピックタイトル）"
              className={fieldClass}
            />
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={NOTE_CONTENT_MAX}
              rows={3}
              aria-label="覚えること"
              className={cn(fieldClass, "resize-none leading-relaxed")}
            />
          </AskForm>
        </SkipLabelContext.Provider>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
