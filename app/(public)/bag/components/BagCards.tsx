'use client';

import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Circle, ClipboardList, Edit2, Map as MapIcon, Package, Plus, Store } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { BagItem } from "../../../../lib/storage/BagContext";
import type { BagGroup, DraftItem } from "../types";

export function QuickAddPanel({
  isOpen,
  showDetails,
  draft,
  onOpen,
  onToggleDetails,
  onChange,
  onCancel,
  onSave,
}: {
  isOpen: boolean;
  showDetails: boolean;
  draft: DraftItem;
  onOpen: () => void;
  onToggleDetails: () => void;
  onChange: (next: DraftItem) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">買うものを追加</h2>
          <p className="mt-1 text-sm text-slate-600">名前だけでもすぐ追加できます。</p>
        </div>
        {!isOpen && (
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-black active:scale-[0.98]"
          >
            <Plus size={16} />
            追加
          </button>
        )}
      </div>

      {isOpen && (
        <div className="mt-4 space-y-3 rounded-3xl border border-stone-200 bg-stone-50 p-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-bold text-slate-700">名前</span>
            <input
              value={draft.name}
              onChange={(event) => onChange({ ...draft, name: event.target.value })}
              placeholder="例：塩、にんじん、家の牛乳"
              className="min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-amber-400"
            />
          </label>

          {showDetails ? (
            <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-bold text-slate-700">数量</span>
                <input
                  value={draft.qty}
                  onChange={(event) => onChange({ ...draft, qty: event.target.value })}
                  placeholder="例：2個"
                  className="min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-amber-400"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-bold text-slate-700">メモ</span>
                <Textarea
                  value={draft.note}
                  onChange={(event) => onChange({ ...draft, note: event.target.value })}
                  placeholder="任意でメモ"
                  rows={2}
                  className="min-h-[84px] rounded-2xl border-stone-200 bg-white text-sm text-slate-900 focus-visible:ring-amber-400"
                />
              </label>
            </div>
          ) : (
            <button
              type="button"
              onClick={onToggleDetails}
              className="text-sm font-bold text-amber-700 transition hover:text-amber-800"
            >
              数量やメモも入れる
            </button>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-11 items-center rounded-2xl border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-stone-50 active:scale-[0.98]"
            >
              閉じる
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!draft.name.trim()}
              className="inline-flex min-h-11 items-center rounded-2xl bg-amber-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-600 disabled:bg-stone-300 active:scale-[0.98]"
            >
              追加する
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function BagGroupSection({
  group,
  checkedIds,
  onToggleCheck,
  onEditItem,
}: {
  group: BagGroup;
  checkedIds: Set<string>;
  onToggleCheck: (id: string) => void;
  onEditItem: (item: BagItem) => void;
}) {
  const orderedItems = [...group.items].sort((a, b) => {
    const aChecked = checkedIds.has(a.id) ? 1 : 0;
    const bChecked = checkedIds.has(b.id) ? 1 : 0;
    if (aChecked !== bChecked) return aChecked - bChecked;
    return b.createdAt - a.createdAt;
  });

  return (
    <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
      <div className={cn("border-b border-stone-100 px-4 py-4", group.isOther ? "bg-stone-50" : "bg-amber-50/60")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/80 bg-white shadow-sm">
              {group.imageUrl ? (
                <Image src={group.imageUrl} alt="" width={44} height={44} className="h-full w-full object-cover" />
              ) : group.isOther ? (
                <Package size={18} className="text-stone-500" />
              ) : (
                <Store size={18} className="text-amber-700" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-black text-slate-900">{group.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{group.subtitle}</p>
            </div>
          </div>
          {!group.isOther && group.shop && (
            <Link
              href={`/map?shop=${group.shop.id}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-stone-50 active:scale-[0.98]"
            >
              <MapIcon size={15} />
              場所
            </Link>
          )}
        </div>
      </div>

      <div className="divide-y divide-stone-100">
        {orderedItems.map((item) => (
          <BagItemRow
            key={item.id}
            item={item}
            isChecked={checkedIds.has(item.id)}
            onToggleCheck={onToggleCheck}
            onEdit={() => onEditItem(item)}
          />
        ))}
      </div>
    </section>
  );
}

function BagItemRow({
  item,
  isChecked,
  onToggleCheck,
  onEdit,
}: {
  item: BagItem;
  isChecked: boolean;
  onToggleCheck: (id: string) => void;
  onEdit: () => void;
}) {
  return (
    <div className={cn("px-4 py-4", isChecked && "bg-stone-50/80")}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onToggleCheck(item.id)}
          className={cn(
            "inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-2xl border transition",
            isChecked
              ? "border-emerald-200 bg-emerald-50 text-emerald-600"
              : "border-stone-200 bg-white text-stone-400 hover:border-emerald-200 hover:text-emerald-600"
          )}
          aria-label={isChecked ? "未完了に戻す" : "完了にする"}
        >
          {isChecked ? <CheckCircle2 size={22} /> : <Circle size={22} />}
        </button>

        <button
          type="button"
          onClick={() => onToggleCheck(item.id)}
          className="min-w-0 flex-1 text-left"
        >
          <p className={cn("text-[15px] font-bold leading-snug text-slate-900", isChecked && "text-stone-500 line-through")}>
            {item.name}
          </p>

          {(item.qty || item.note || (typeof item.price === "number" && item.price > 0)) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {item.qty && (
                <span className="inline-flex min-h-8 items-center rounded-full bg-stone-100 px-3 text-[12px] font-bold text-stone-700">
                  数量 {item.qty}
                </span>
              )}
              {typeof item.price === "number" && item.price > 0 && (
                <span className="inline-flex min-h-8 items-center rounded-full bg-emerald-50 px-3 text-[12px] font-bold text-emerald-700">
                  ¥{item.price.toLocaleString()}
                </span>
              )}
            </div>
          )}

          {item.note && (
            <p className={cn("mt-2 text-[13px] leading-relaxed text-stone-600", isChecked && "text-stone-500")}>
              {item.note}
            </p>
          )}
        </button>

        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-500 transition hover:text-slate-800 active:scale-[0.98]"
          aria-label="項目を編集"
        >
          <Edit2 size={16} />
        </button>
      </div>
    </div>
  );
}

export function EmptyState() {
  return (
    <section className="rounded-[32px] border border-stone-200 bg-white px-6 py-12 text-center shadow-sm">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-stone-100">
        <ClipboardList size={34} className="text-amber-600" />
      </div>
      <h2 className="mt-5 text-2xl font-black text-slate-900">まだ何も入っていません</h2>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
        マップから気になるものを追加すると、ここでまとめて確認できます。
      </p>
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/map"
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-black active:scale-[0.98]"
        >
          <MapIcon size={16} />
          マップを見る
        </Link>
      </div>
    </section>
  );
}
