"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader } from "@/components/admin";
import { formatEventDate, getRelativeSundayLabel } from "@/lib/market/calendar";
import { useAdminEvents, SUNDAY_COUNT } from "./useAdminEvents";
import type { MarketEvent } from "@/app/api/admin/events/route";
import { useAdminMarketDays } from "./useAdminMarketDays";
import { MarketDayStatusEditor, MarketDayStatusChip } from "./MarketDayStatusEditor";
import { EventRow } from "./EventRow";
import { EventForm } from "./EventForm";

export default function AdminCalendarPage() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isAdmin) router.push("/");
  }, [isLoading, permissions.isAdmin, router]);

  const e = useAdminEvents({ isAdmin: permissions.isAdmin });
  const d = useAdminMarketDays({ isAdmin: permissions.isAdmin });

  // 各カードは既定で畳んでおく。ステータス編集の常時表示は縦に長くなりすぎるため、
  // 触りたい週だけタップで開く（events/market-days 統合時のフィードバックで追加）
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const toggleExpanded = (dateIso: string) =>
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateIso)) next.delete(dateIso);
      else next.add(dateIso);
      return next;
    });
  const expand = (dateIso: string) =>
    setExpandedDates((prev) => (prev.has(dateIso) ? prev : new Set(prev).add(dateIso)));

  // 予定の追加・編集フォームをどのカードの中に出すか。null は「表示範囲外の予定」の枠。
  // 以前は独立したモーダルでどの日の編集か分かりにくかったため、該当カードの中に出す
  const [formDateIso, setFormDateIso] = useState<string | null>(null);
  const openCreateIn = (dateIso: string) => {
    expand(dateIso);
    setFormDateIso(dateIso);
    e.openCreate(dateIso);
  };
  const openEditIn = (dateIso: string | null, event: MarketEvent) => {
    setFormDateIso(dateIso);
    e.openEdit(event);
  };

  return (
    <AdminLayout>
      <AdminPageHeader eyebrow="日曜市カレンダー" title="開催ステータス・予定の入稿" />

      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        開催ステータスは<strong>「保存する」を押した時点で公開</strong>され、マップと近況ページの
        最上部に表示されます。予定は日曜ごとに何件でも追加でき、
        <strong>必須はタイトルと種別だけ</strong>です。各日のカードはタップで開閉します。
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={e.showAll}
            onChange={(ev) => e.setShowAll(ev.target.checked)}
            className="accent-amber-500"
          />
          非公開の予定も表示する
        </label>
      </div>

      {e.loading || d.loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">読み込み中...</div>
      ) : (
        <div className="space-y-3">
          {e.sundays.map(({ dateIso, weeksAhead, items }) => {
            const isExpanded = expandedDates.has(dateIso);
            return (
              <div
                key={dateIso}
                className={`rounded-xl border bg-white shadow-sm ${
                  weeksAhead === 0 ? "border-amber-300" : "border-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(dateIso)}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left ${
                    isExpanded ? "rounded-t-xl" : "rounded-xl"
                  } ${weeksAhead === 0 ? "bg-amber-50" : "bg-slate-50"}`}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  )}
                  <span className="font-semibold text-slate-900">{formatEventDate(dateIso)}</span>
                  <span className="text-xs text-slate-400">{getRelativeSundayLabel(weeksAhead)}</span>
                  <MarketDayStatusChip status={d.committedStatusFor(dateIso)} />
                  <span className="text-xs text-slate-400">{items.length}件</span>
                </button>

                {isExpanded && (
                  <>
                    <div className="border-b border-slate-100 px-4 py-3">
                      <MarketDayStatusEditor
                        committedStatus={d.committedStatusFor(dateIso)}
                        draftStatus={d.draftStatusFor(dateIso)}
                        noteDraft={d.noteFor(dateIso)}
                        isDirty={d.isDirty(dateIso)}
                        isSaving={d.savingDate === dateIso}
                        recentNotes={d.recentNotes}
                        onSelectStatus={(status) => d.setStatusDraft(dateIso, status)}
                        onSetNoteDraft={(note) => d.setNoteDraft(dateIso, note)}
                        onSave={() =>
                          void d.save(dateIso, d.draftStatusFor(dateIso) ?? "open", d.noteFor(dateIso))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs font-semibold text-slate-600">予定</span>
                      <button
                        type="button"
                        onClick={() => openCreateIn(dateIso)}
                        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                      >
                        ＋ 予定を追加
                      </button>
                    </div>

                    {items.length === 0 ? (
                      <p className="px-4 pb-4 text-sm text-slate-400">予定はありません</p>
                    ) : (
                      <div className="divide-y divide-slate-100 border-t border-slate-100">
                        {items.map((event) => (
                          <EventRow
                            key={`${dateIso}-${event.id}`}
                            event={event}
                            sundayIso={dateIso}
                            deleting={e.deletingId === event.id}
                            onEdit={(ev) => openEditIn(dateIso, ev)}
                            onDelete={e.handleDelete}
                            onTogglePublish={e.handleTogglePublish}
                          />
                        ))}
                      </div>
                    )}

                    {e.showForm && formDateIso === dateIso && (
                      <EventForm e={e} onClose={() => e.setShowForm(false)} />
                    )}
                  </>
                )}
              </div>
            );
          })}

          {e.outOfRange.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="rounded-t-xl bg-slate-50 px-4 py-2.5">
                <span className="font-semibold text-slate-900">表示範囲外の予定</span>
                <span className="ml-2 text-xs text-slate-400">
                  過去、または{SUNDAY_COUNT}週より先
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {e.outOfRange.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    sundayIso={null}
                    deleting={e.deletingId === event.id}
                    onEdit={(ev) => openEditIn(null, ev)}
                    onDelete={e.handleDelete}
                    onTogglePublish={e.handleTogglePublish}
                  />
                ))}
              </div>
              {e.showForm && formDateIso === null && (
                <EventForm e={e} onClose={() => e.setShowForm(false)} />
              )}
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
