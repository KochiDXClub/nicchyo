"use client";

import { type FormEvent } from "react";
import Image from "next/image";
import { AlertCircle, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import type { ExpirationPreset } from "../../../_types";
import { EXPIRATION_OPTIONS, formatExpiresAt, localDateTimeInputValue } from "../expiration";

export const MAX_TEXT = 300;

type Props = {
  imageUrl: string;
  shopName: string;
  shopImageUrl: string | null;
  text: string;
  onTextChange: (text: string) => void;
  preset: ExpirationPreset;
  onPresetChange: (preset: ExpirationPreset) => void;
  customDateTime: string;
  onCustomDateTimeChange: (value: string) => void;
  /** 選んだ期間で出しておける期限。決まっていなければ null */
  expiresAt: Date | null;
  submitting: boolean;
  error: string | null;
  onDiscard: () => void;
  onSubmit: () => void;
};

/**
 * 写真の上に、ひとことを書き込む。近況で見えるのと同じ並び
 * （写真を切り取らずに収め、上に店名、下に文字）にして、書いたものがそのまま出ると分かるようにする。
 */
export default function StoryComposer({
  imageUrl,
  shopName,
  shopImageUrl,
  text,
  onTextChange,
  preset,
  onPresetChange,
  customDateTime,
  onCustomDateTimeChange,
  expiresAt,
  submitting,
  error,
  onDiscard,
  onSubmit,
}: Props) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  const nearLimit = text.length > MAX_TEXT * 0.9;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-busy={submitting}>
      <div className="relative mx-auto aspect-[3/4] w-full overflow-hidden rounded-card bg-black shadow-lift">
        <Image
          src={imageUrl}
          alt="投稿する写真"
          fill
          sizes="(min-width: 640px) 32rem, 100vw"
          className="select-none object-contain"
          // 端末の中の写真（blob URL）は最適化を通せない
          unoptimized={imageUrl.startsWith("blob:")}
        />

        <div className="absolute inset-x-0 top-0 flex items-center gap-2.5 bg-gradient-to-b from-black/60 to-transparent px-4 pb-8 pt-4">
          {shopImageUrl ? (
            <Image
              src={shopImageUrl}
              alt=""
              width={32}
              height={32}
              // 小さな名札なので最適化は通さない（写真の置き場所のドメインにも左右されない）
              unoptimized
              className="h-8 w-8 shrink-0 rounded-chip object-cover ring-2 ring-white/70"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip bg-nicchyo-primary text-sm font-bold text-white"
            >
              {shopName.slice(0, 1)}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{shopName}</span>
          <button
            type="button"
            onClick={onDiscard}
            disabled={submitting}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-chip bg-black/40 text-white transition hover:bg-black/60 disabled:opacity-45"
            aria-label="写真を選び直す"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-16">
          <label htmlFor="post-text" className="sr-only">
            ひとこと（なくても出せます）
          </label>
          <textarea
            id="post-text"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="ひとこと添える（なくてもOK）"
            maxLength={MAX_TEXT}
            rows={3}
            className="w-full resize-none bg-transparent text-base leading-relaxed text-white placeholder-white/70 outline-none [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]"
          />
          {nearLimit && (
            <p className="text-right text-xs text-white/80">
              {text.length} / {MAX_TEXT}
            </p>
          )}
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-nicchyo-ink/70">出しておく期間</legend>
        <div className="flex flex-wrap gap-2">
          {EXPIRATION_OPTIONS.map((option) => {
            const selected = preset === option.preset;
            return (
              <button
                key={option.preset}
                type="button"
                aria-pressed={selected}
                onClick={() => onPresetChange(option.preset)}
                className={cn(
                  "h-11 rounded-chip px-4 text-sm font-semibold transition",
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
        {preset === "custom" && (
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm text-nicchyo-ink/70">いつまで出す？</span>
            <input
              type="datetime-local"
              value={customDateTime}
              onChange={(e) => onCustomDateTimeChange(e.target.value)}
              min={localDateTimeInputValue(new Date())}
              aria-describedby={expiresAt ? undefined : "post-expires-hint"}
              className="w-full rounded-btn bg-white px-3 py-3 text-base text-nicchyo-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-amber-400"
            />
            {/* 日時が無い・過ぎているあいだは出すボタンを押せないので、理由をここに出す */}
            {!expiresAt && (
              <span id="post-expires-hint" className="mt-1.5 block text-sm text-amber-800">
                {customDateTime ? "これから先の日時を選んでください" : "日時を選ぶと出せます"}
              </span>
            )}
          </label>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-btn bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={submitting || !expiresAt}>
        {submitting ? (
          <>
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            出しています…
          </>
        ) : (
          <>
            <Send size={18} aria-hidden="true" />
            近況に出す
            {expiresAt && (
              <span className="text-sm font-normal opacity-80">（{formatExpiresAt(preset, expiresAt)}）</span>
            )}
          </>
        )}
      </Button>
    </form>
  );
}
