"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { PublicAnnouncement } from "@/lib/announcements/schema";

const DISMISSED_KEY = "nicchyo:dismissed-announcements";

function loadDismissed(): string[] {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function saveDismissed(ids: string[]) {
  try {
    // 古い ID が溜まらないよう、新しい 50 件だけ残す
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids.slice(-50)));
  } catch {
    // 保存できなくても、この画面を開いている間は閉じたままにする
  }
}

/**
 * サイト内のお知らせのバナー（地図ページの上部）。公開中のお知らせのうち、まだ閉じていない
 * いちばん上の1件を見出しで出し、タップで /news へ。ほかにもあれば「ほかN件」を添える。
 * 閉じたお知らせは、その端末では出し直さない（お知らせごと）。重要なものは目立たせる。
 * 読み込めなかったとき・無いときは何も出さない（地図の邪魔をしない）。
 */
export default function AnnouncementBanner({ className }: { className?: string }) {
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    setDismissed(loadDismissed());
    let cancelled = false;
    fetch("/api/announcements")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { announcements?: PublicAnnouncement[] } | null) => {
        if (!cancelled && Array.isArray(json?.announcements)) setAnnouncements(json.announcements);
      })
      .catch(() => {
        // 読めなくても地図は使える。静かに出さない
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = announcements.filter((a) => !dismissed.includes(a.id));
  const top = visible[0];
  if (!top) return null;
  const rest = visible.length - 1;

  const dismiss = () => {
    const next = [...dismissed, top.id];
    setDismissed(next);
    saveDismissed(next);
  };

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2 rounded-card py-2 pl-3 pr-1.5 shadow-lg ring-1 backdrop-blur-sm",
        top.important ? "bg-amber-500/95 text-white ring-amber-600/30" : "bg-white/90 text-nicchyo-ink ring-amber-200",
        className
      )}
    >
      <Megaphone size={16} aria-hidden="true" className={cn("shrink-0", !top.important && "text-amber-600")} />
      <Link href="/news" className="min-w-0 flex-1 text-[13px] font-semibold leading-snug">
        <span className="line-clamp-2">{top.title}</span>
        {rest > 0 && (
          <span className={cn("ml-1 text-[11px] font-medium", top.important ? "text-white/90" : "text-nicchyo-ink/55")}>
            ほか{rest}件
          </span>
        )}
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="このお知らせを閉じる"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full active:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
