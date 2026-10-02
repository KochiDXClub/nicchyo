"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, MessageCircle, Search } from "lucide-react";
import { Button, EmptyState, Surface, buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { VENDOR_FAQ, VENDOR_FAQ_CATEGORIES, type VendorFaqCategory } from "@/lib/vendor/helpFaq";
import { findVendorHelpPage } from "@/lib/vendor/helpPages";

type CategoryFilter = VendorFaqCategory | "all";

const CHIP_BASE = "flex-shrink-0 rounded-chip px-4 py-2 text-sm font-bold transition";

export default function VendorFaqClient() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());

  const items = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return VENDOR_FAQ.filter(
      (item) =>
        (category === "all" || item.category === category) &&
        (!keyword || item.q.toLowerCase().includes(keyword) || item.a.toLowerCase().includes(keyword))
    );
  }, [category, query]);

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <label className="relative block">
          <span className="sr-only">キーワードで探す</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-600" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="キーワードで探す（例：写真、雨の日）"
            className="h-12 w-full rounded-chip bg-white pl-12 pr-4 text-base text-nicchyo-ink shadow-card ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </label>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ id: "all" as const, label: "すべて" }, ...VENDOR_FAQ_CATEGORIES].map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={category === item.id}
              onClick={() => setCategory(item.id)}
              className={cn(
                CHIP_BASE,
                category === item.id ? "bg-amber-600 text-white shadow-chip" : "bg-white text-nicchyo-ink/70 shadow-chip hover:bg-amber-50"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item) => {
            const open = openIds.has(item.id);
            const page = item.href ? findVendorHelpPage(item.href) : null;
            return (
              <Surface as="li" key={item.id} padding="none" className="overflow-hidden">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={open ? `faq-${item.id}` : undefined}
                  onClick={() => toggle(item.id)}
                  className="flex w-full items-start justify-between gap-3 p-4 text-left"
                >
                  <span className="text-base font-bold leading-relaxed text-nicchyo-ink">{item.q}</span>
                  <ChevronDown
                    className={cn("mt-1 h-5 w-5 flex-shrink-0 text-amber-600 transition-transform ease-out-soft", open && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
                {open && (
                  <div id={`faq-${item.id}`} className="border-t border-line px-4 pb-4 pt-3">
                    <p className="text-sm leading-relaxed text-nicchyo-ink/70">{item.a}</p>
                    {item.href && page && (
                      <Link href={item.href} className={buttonClass({ variant: "secondary", size: "sm", className: "mt-3" })}>
                        {page.name}を開く
                      </Link>
                    )}
                  </div>
                )}
              </Surface>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={Search}
          title="合う質問が見つかりませんでした"
          description="言葉を変えるか、にちよさんに聞いてみてください。"
          action={
            <Button
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
            >
              すべての質問を見る
            </Button>
          }
        />
      )}

      <Surface className="text-center">
        <MessageCircle className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
        <h2 className="mt-2 text-base font-bold text-nicchyo-ink">解決しませんでしたか？</h2>
        <p className="mt-1 text-sm text-nicchyo-ink/70">にちよさんに話しかけると、答えたり、お店の情報を直す案を出したりします。</p>
        <Link href="/my-shop" className={buttonClass({ className: "mt-4" })}>
          にちよさんに聞く
        </Link>
      </Surface>
    </div>
  );
}
