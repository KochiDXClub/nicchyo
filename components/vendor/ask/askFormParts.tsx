"use client";

import { createContext, useContext, type FormEvent, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import type { AskAnswer, AskQuestion, VendorAskSnapshot } from "@/lib/vendor/askQuestions";

// 質問の入力欄（AskInputs / ProfileInputs）が共有する、枠と見た目の部品。

export const fieldClass =
  "w-full rounded-btn bg-nicchyo-base px-4 py-3 text-base text-nicchyo-ink ring-1 ring-line placeholder:text-nicchyo-ink/40 focus:outline-none focus:ring-2 focus:ring-amber-500/60";

export const choiceClass = (selected: boolean) =>
  cn(
    "flex min-h-11 items-center gap-2 rounded-btn px-4 py-2.5 text-left text-sm font-semibold transition",
    selected
      ? "bg-amber-50 text-amber-900 ring-2 ring-amber-500"
      : "bg-white text-nicchyo-ink ring-1 ring-line"
  );

/**
 * 下の「あとで」ボタンの文言。トップでは「あとで」、編集画面では「やめとく」のように
 * 使い方で変えたい。入力欄ごとに props を通すと配線が増えるので、文脈で渡す。
 */
export const SkipLabelContext = createContext("あとで");

type AskFormProps = {
  canSubmit: boolean;
  saving: boolean;
  onSubmit: () => void;
  onSkip: () => void;
  children: ReactNode;
};

/** 入力欄の下に「これでええ」「あとで」を置く共通の枠 */
export function AskForm({ canSubmit, saving, onSubmit, onSkip, children }: AskFormProps) {
  const skipLabel = useContext(SkipLabelContext);
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit && !saving) onSubmit();
  };
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {children}
      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" disabled={!canSubmit || saving}>
          {saving ? "保存しよるよ…" : "これでええ！"}
        </Button>
        <Button type="button" variant="quiet" size="sm" disabled={saving} onClick={onSkip}>
          {skipLabel}
        </Button>
      </div>
    </form>
  );
}

export type InputProps = {
  question: AskQuestion;
  snapshot: VendorAskSnapshot;
  saving: boolean;
  onSubmit: (answer: AskAnswer) => void;
  onSkip: () => void;
};

/** 入力欄の下に並べる、外せるチップ（商品名・スタイル・日程など） */
export function RemovableChip({
  label,
  onRemove,
  tone = "soft",
}: {
  label: string;
  onRemove: () => void;
  /** soft=入れた物の一覧、selected=選択中の印（選択肢と並べるとき） */
  tone?: "soft" | "selected";
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-chip bg-amber-50 py-1.5 pl-3.5 pr-2 text-sm font-semibold text-amber-900",
        tone === "selected" ? "min-h-9 ring-2 ring-amber-500" : "ring-1 ring-amber-200"
      )}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${label}を外す`}
        className="flex h-6 w-6 items-center justify-center rounded-full text-amber-700"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </span>
  );
}

/** 1つずつ足していく入力欄と、足すボタン。Enter でも足せる */
export function DraftAddRow({
  value,
  onChange,
  onAdd,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  placeholder?: string;
  label: string;
}) {
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // 日本語変換の確定 Enter で追加してしまわないようにする
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          onAdd();
        }}
        placeholder={placeholder}
        aria-label={label}
        enterKeyHint="done"
        className={fieldClass}
      />
      <Button type="button" variant="secondary" size="icon" onClick={onAdd} aria-label="追加する">
        <Plus size={18} aria-hidden="true" />
      </Button>
    </div>
  );
}
