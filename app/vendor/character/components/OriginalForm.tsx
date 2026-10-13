"use client";

import { useRef, type ChangeEvent } from "react";
import { ImagePlus, Send } from "lucide-react";
import { Button, Surface } from "@/components/ui";
import { missingForSubmit, type OriginalCharacterDraft, type ReviewStatus } from "@/lib/vendor/character/types";
import CharacterAvatar from "./CharacterAvatar";

type Props = {
  draft: OriginalCharacterDraft;
  status: ReviewStatus;
  onChange: (patch: Partial<OriginalCharacterDraft>) => void;
  onSubmit: () => void;
};

const fieldClass =
  "mt-1 w-full rounded-btn bg-white px-3 py-2.5 text-base text-nicchyo-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-amber-500/60";

/** オリジナルキャラを作る。自分のイラストと、自由な話し方で。使うには運営の確認が要る */
export default function OriginalForm({ draft, status, onChange, onSubmit }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const missing = missingForSubmit(draft);
  const pending = status.state === "pending";

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onChange({ illustrationUrl: URL.createObjectURL(file) });
  }

  return (
    <Surface className="space-y-5">
      <div className="flex items-center gap-4">
        <CharacterAvatar name={draft.name} image={draft.illustrationUrl} size="lg" />
        <div>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <ImagePlus size={16} aria-hidden="true" />
            {draft.illustrationUrl ? "イラストを変える" : "イラストを選ぶ"}
          </Button>
          <p className="mt-1.5 text-xs leading-relaxed text-nicchyo-ink/55">
            ご自身で描いた、または使ってよいと確かめたイラストにしてください。
          </p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} aria-label="イラストを選ぶ" />
        </div>
      </div>

      <label className="block text-sm font-bold text-nicchyo-ink">
        名前
        <input className={fieldClass} value={draft.name} maxLength={12} placeholder="例：トマトじいさん" onChange={(e) => onChange({ name: e.target.value })} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-bold text-nicchyo-ink">
          一人称
          <input className={fieldClass} value={draft.firstPerson} maxLength={6} placeholder="例：わし" onChange={(e) => onChange({ firstPerson: e.target.value })} />
        </label>
        <label className="block text-sm font-bold text-nicchyo-ink">
          語尾・口ぐせ
          <input className={fieldClass} value={draft.ending} maxLength={10} placeholder="例：〜じゃき" onChange={(e) => onChange({ ending: e.target.value })} />
        </label>
      </div>

      <label className="block text-sm font-bold text-nicchyo-ink">
        話し方・性格のメモ
        <textarea
          className={`${fieldClass} min-h-24`}
          value={draft.speechNote}
          maxLength={200}
          placeholder="例：畑育ちの頑固者。ぶっきらぼうだが、野菜の話になると止まらない。"
          onChange={(e) => onChange({ speechNote: e.target.value })}
        />
      </label>

      <div className="rounded-btn bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
        オリジナルのキャラは、運営の確認が終わってから、お客さんに出ます。確認の間は、いまのキャラのままです。
      </div>

      {missing.length > 0 && !pending && (
        <p className="text-xs text-nicchyo-ink/55">申請には、{missing.join("・")}が要ります。</p>
      )}
      <Button className="w-full" disabled={missing.length > 0 || pending} onClick={onSubmit}>
        <Send size={18} aria-hidden="true" />
        {pending ? "運営が確認中です" : "運営に申請する"}
      </Button>
    </Surface>
  );
}
