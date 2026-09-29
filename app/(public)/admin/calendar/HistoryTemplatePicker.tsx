import { useMemo, useState } from "react";
import { getCategoryPresentation, normalizeCategory, type MarketEventCategory } from "@/lib/market/calendar";
import type { MarketEvent } from "@/app/api/admin/events/route";
import { CATEGORY_OPTIONS } from "./useAdminEvents";

function CategoryFilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        active
          ? "border-amber-400 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-white text-slate-500"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * 過去の投稿を種別ごとに絞り込んで選べるUI。
 *
 * 出店者側の「そのまま再投稿」とは異なり、選択しても即座には投稿されない。
 * あくまでフォームへの下書き反映にとどめ、投稿前に必ず内容を確認・編集
 * できるようにする（雨天中止のお知らせのように繰り返しがちな投稿でも、
 * 日付や状況は毎回違うため）。
 */
export function HistoryTemplatePicker({
  events,
  onSelect,
}: {
  events: MarketEvent[];
  onSelect: (event: MarketEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<MarketEventCategory | "all">("all");

  const filtered = useMemo(
    () =>
      categoryFilter === "all"
        ? events
        : events.filter((e) => normalizeCategory(e.category) === categoryFilter),
    [events, categoryFilter]
  );

  // 履歴が無い（初めての利用）ときは出しても意味がないので出さない
  if (events.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-xs font-semibold text-slate-600">
          過去の投稿から下書きを作る（任意）
        </span>
        <span className="text-xs text-slate-400">{open ? "閉じる" : "開く"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-3 py-3">
          <div className="flex flex-wrap gap-1.5">
            <CategoryFilterChip
              label="すべて"
              active={categoryFilter === "all"}
              onClick={() => setCategoryFilter("all")}
            />
            {CATEGORY_OPTIONS.map((option) => {
              const { label, emoji } = getCategoryPresentation(option.value);
              return (
                <CategoryFilterChip
                  key={option.value}
                  label={`${emoji} ${label}`}
                  active={categoryFilter === option.value}
                  onClick={() => setCategoryFilter(option.value)}
                />
              );
            })}
          </div>

          <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">該当する投稿がありません</p>
            ) : (
              filtered.map((event) => {
                const { label, emoji } = getCategoryPresentation(normalizeCategory(event.category));
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onSelect(event)}
                    className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left hover:border-amber-300 hover:bg-amber-50"
                  >
                    {event.image_url ? (
                      // 履歴一覧の小さなプレビューなので next/image の最適化は不要
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={event.image_url}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-slate-50 text-base"
                        aria-hidden
                      >
                        {emoji}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800">
                        {event.title}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {label} ・ {event.event_date}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
