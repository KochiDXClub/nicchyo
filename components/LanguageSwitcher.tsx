"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * 言語の切り替え。ヘッダーの右に置く。
 *
 * 多言語対応の基盤（docs の多言語化計画）がまだ入っていないので、いまは日本語だけが選べる。
 * 他の言語は「準備中」として並べておき、翻訳が入った言語から disabled を外していく。
 * 選んだ言語の保存や URL の切り替えは、基盤が入ったときにここへつなぐ。
 */
const LANGUAGES = [
  { code: "ja", label: "日本語", ready: true },
  { code: "en", label: "English", ready: false },
  { code: "zh-Hant", label: "繁體中文", ready: false },
  { code: "zh-Hans", label: "简体中文", ready: false },
  { code: "ko", label: "한국어", ready: false },
] as const;

type Props = {
  /** photo … 写真の上（白い文字）。page … クリーム地の上（濃い文字） */
  tone?: "photo" | "page";
  className?: string;
};

export default function LanguageSwitcher({ tone = "page", className }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = "ja";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="言語を選ぶ (Language)"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-chip px-3 text-sm font-semibold transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
          tone === "photo"
            ? "text-white hover:bg-white/15 focus-visible:ring-white/70"
            : "text-nicchyo-ink/80 hover:bg-nicchyo-ink/[0.06]"
        )}
      >
        <Globe aria-hidden className="h-4 w-4" />
        <span>日本語</span>
        <ChevronDown aria-hidden className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label="言語"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-44 overflow-hidden rounded-card bg-white py-1.5 text-nicchyo-ink shadow-float ring-1 ring-line"
        >
          {LANGUAGES.map((lang) => (
            <li key={lang.code} role="option" aria-selected={lang.code === current} aria-disabled={!lang.ready}>
              <button
                type="button"
                disabled={!lang.ready}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm",
                  lang.ready ? "hover:bg-nicchyo-base" : "cursor-not-allowed text-nicchyo-ink/40"
                )}
              >
                <span className="flex-1">{lang.label}</span>
                {lang.code === current ? <Check aria-hidden className="h-4 w-4 text-nicchyo-ink/70" /> : null}
                {!lang.ready ? <span className="text-[11px]">準備中</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
