"use client";

import { forwardRef } from "react";
import { Search } from "lucide-react";
import { Surface } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

export interface ReviewFilter<T extends string> {
  key: T;
  label: string;
  count?: number;
}

interface ReviewToolbarProps<T extends string> {
  filters: readonly ReviewFilter<T>[];
  value: T;
  onChange: (next: T) => void;
  search: {
    value: string;
    onChange: (next: string) => void;
    placeholder: string;
  };
  /** フィルターの下の段（カテゴリ絞り込みなど） */
  children?: React.ReactNode;
}

/** 絞り込みのピル。ReviewToolbar の状態の絞り込みと、その下に足す副フィルター（カテゴリなど）で共通 */
export function FilterChip({
  active,
  onClick,
  size = "md",
  children,
}: {
  active: boolean;
  onClick: () => void;
  size?: "md" | "sm";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-chip font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
        size === "md" ? "px-3.5 py-1.5 text-sm" : "px-3 py-1 text-xs",
        active ? "bg-nicchyo-ink text-white" : "bg-nicchyo-ink/[0.06] text-nicchyo-ink/70 hover:bg-nicchyo-ink/10"
      )}
    >
      {children}
    </button>
  );
}

/**
 * 絞り込み（状態のピル）と検索を1枚の面にまとめた帯。
 * 検索欄の ref は、キーボードショートカットでフォーカスを移したい画面のために受け渡せる。
 */
function ReviewToolbarInner<T extends string>(
  { filters, value, onChange, search, children }: ReviewToolbarProps<T>,
  searchRef: React.ForwardedRef<HTMLInputElement>
) {
  return (
    <Surface padding="sm" className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="状態で絞り込む" className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <FilterChip key={f.key} active={f.key === value} onClick={() => onChange(f.key)}>
              {f.label}
              {f.count !== undefined && <span className="ml-1 tabular-nums">({f.count})</span>}
            </FilterChip>
          ))}
        </div>
        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search
              size={14}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-nicchyo-ink/40"
            />
            <input
              ref={searchRef}
              type="search"
              aria-label={search.placeholder}
              placeholder={search.placeholder}
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              className="w-full rounded-btn border border-line bg-white py-2 pl-8 pr-3 text-sm text-nicchyo-ink placeholder:text-nicchyo-ink/40 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>
        </div>
      </div>
      {children}
    </Surface>
  );
}

export const ReviewToolbar = forwardRef(ReviewToolbarInner) as <T extends string>(
  props: ReviewToolbarProps<T> & { ref?: React.Ref<HTMLInputElement> }
) => React.ReactElement;
