"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader } from "@/components/admin";
import { showToast } from "@/lib/admin/toast";
import {
  formatEventDate,
  formatEventPeriod,
  formatEventTime,
  getCategoryPresentation,
  getRelativeSundayLabel,
  getUpcomingSundayIso,
  isEventOnSunday,
  normalizeCategory,
  type MarketEvent as PublicMarketEvent,
  type MarketEventCategory,
} from "@/lib/market/calendar";
import type { MarketEvent } from "@/app/api/admin/events/route";

/** 管理画面に並べる日曜の数 */
const SUNDAY_COUNT = 8;

const CATEGORY_OPTIONS: { value: MarketEventCategory; hint: string }[] = [
  { value: "season", hint: "今が旬のもの" },
  { value: "vendor", hint: "特別出店・出店予定" },
  { value: "event", hint: "催し・まつり" },
  { value: "notice", hint: "そのほかの連絡" },
];

type EventForm = {
  title: string;
  description: string;
  event_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  location: string;
  is_published: boolean;
  category: MarketEventCategory;
  image_url: string;
  is_highlight: boolean;
};

function emptyForm(eventDate: string): EventForm {
  return {
    title: "",
    description: "",
    event_date: eventDate,
    end_date: "",
    start_time: "",
    end_time: "",
    location: "",
    // 入稿の手間を減らすため既定で公開。非公開にしたいときだけ外す
    is_published: true,
    category: "event",
    image_url: "",
    is_highlight: false,
  };
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 公開側と同じ判定を使うため、管理APIの行を公開側の型に寄せる */
function toPublicEvent(event: MarketEvent): PublicMarketEvent {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    event_date: event.event_date,
    end_date: event.end_date ?? null,
    start_time: event.start_time,
    end_time: event.end_time,
    location: event.location,
    category: normalizeCategory(event.category),
    image_url: event.image_url ?? null,
    is_highlight: event.is_highlight ?? false,
  };
}

export default function AdminEventsPage() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();

  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MarketEvent | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm(""));
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isAdmin) router.push("/");
  }, [isLoading, permissions.isAdmin, router]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/events?all=${showAll ? "1" : "0"}`);
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { events: MarketEvent[] };
      setEvents(data.events);
    } catch {
      showToast.error("イベントの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => {
    if (!permissions.isAdmin) return;
    void fetchEvents();
  }, [fetchEvents, permissions.isAdmin]);

  // 日曜ごとに束ねる。連続開催の予定は期間内のすべての日曜に現れる。
  const sundays = useMemo(() => {
    const first = getUpcomingSundayIso();
    const publicEvents = events.map(toPublicEvent);
    return Array.from({ length: SUNDAY_COUNT }, (_, weeksAhead) => {
      const dateIso = addDays(first, weeksAhead * 7);
      const ids = new Set(
        publicEvents.filter((e) => isEventOnSunday(e, dateIso)).map((e) => e.id)
      );
      return {
        dateIso,
        weeksAhead,
        items: events.filter((e) => ids.has(e.id)),
      };
    });
  }, [events]);

  // 表示範囲の外にある予定（過去や8週より先）は取りこぼさないよう別枠で出す
  const outOfRange = useMemo(() => {
    const shown = new Set(sundays.flatMap((s) => s.items.map((i) => i.id)));
    return events.filter((e) => !shown.has(e.id));
  }, [events, sundays]);

  const openCreate = (eventDate: string) => {
    setEditingEvent(null);
    setForm(emptyForm(eventDate));
    setShowOptional(false);
    setShowForm(true);
  };

  const openEdit = (event: MarketEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description ?? "",
      event_date: event.event_date,
      end_date: event.end_date ?? "",
      start_time: event.start_time ?? "",
      end_time: event.end_time ?? "",
      location: event.location ?? "",
      is_published: event.is_published,
      category: normalizeCategory(event.category),
      image_url: event.image_url ?? "",
      is_highlight: event.is_highlight ?? false,
    });
    // 何か入っている項目があれば任意欄を開いた状態で見せる
    setShowOptional(
      Boolean(event.end_date ?? event.start_time ?? event.end_time ?? event.location)
    );
    setShowForm(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/events/image", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "failed");
      const url = data.url;
      setForm((prev) => ({ ...prev, image_url: url }));
      showToast.success("画像をアップロードしました");
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    const payload = {
      ...form,
      description: form.description || null,
      end_date: form.end_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location: form.location || null,
      image_url: form.image_url || null,
    };

    setSaving(true);
    try {
      const url = editingEvent ? `/api/admin/events/${editingEvent.id}` : "/api/admin/events";
      const res = await fetch(url, {
        method: editingEvent ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "failed");
      }
      showToast.success(editingEvent ? "更新しました" : "追加しました");
      setShowForm(false);
      void fetchEvents();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event: MarketEvent) => {
    if (!confirm(`「${event.title}」を削除しますか？`)) return;
    setDeletingId(event.id);
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      showToast.success("削除しました");
      void fetchEvents();
    } catch {
      showToast.error("削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePublish = async (event: MarketEvent) => {
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: !event.is_published }),
      });
      if (!res.ok) throw new Error("failed");
      showToast.success(event.is_published ? "非公開にしました" : "公開しました");
      void fetchEvents();
    } catch {
      showToast.error("更新に失敗しました");
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader eyebrow="日曜市カレンダー" title="予定の入稿" />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        日曜ごとに予定を追加します。1つの日曜に何件でも追加できます。
        <strong className="text-slate-800">必須はタイトルと種別だけ</strong>で、
        時間・場所・連続開催・画像はすべて任意です。
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="accent-amber-500"
          />
          非公開も表示する
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">読み込み中...</div>
      ) : (
        <div className="space-y-3">
          {sundays.map(({ dateIso, weeksAhead, items }) => (
            <div
              key={dateIso}
              className={`rounded-xl border bg-white shadow-sm ${
                weeksAhead === 0 ? "border-amber-300" : "border-slate-200"
              }`}
            >
              <div
                className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 ${
                  weeksAhead === 0 ? "bg-amber-50" : "bg-slate-50"
                }`}
              >
                <span className="font-semibold text-slate-900">{formatEventDate(dateIso)}</span>
                <span className="text-xs text-slate-400">
                  {getRelativeSundayLabel(weeksAhead)}
                </span>
                <span className="text-xs text-slate-400">{items.length}件</span>
                <button
                  type="button"
                  onClick={() => openCreate(dateIso)}
                  className="ml-auto rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                >
                  ＋ この日に追加
                </button>
              </div>

              {items.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-400">予定はありません</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {items.map((event) => (
                    <EventRow
                      key={`${dateIso}-${event.id}`}
                      event={event}
                      sundayIso={dateIso}
                      deleting={deletingId === event.id}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onTogglePublish={handleTogglePublish}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          {outOfRange.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="rounded-t-xl bg-slate-50 px-4 py-2.5">
                <span className="font-semibold text-slate-900">表示範囲外の予定</span>
                <span className="ml-2 text-xs text-slate-400">
                  過去、または{SUNDAY_COUNT}週より先
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {outOfRange.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    sundayIso={null}
                    deleting={deletingId === event.id}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onTogglePublish={handleTogglePublish}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10"
          onClick={() => !saving && setShowForm(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-slate-900">
              {editingEvent ? "予定を編集" : `${formatEventDate(form.event_date)} に追加`}
            </h2>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600">タイトル *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  maxLength={100}
                  placeholder="文旦がはじまりました"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">種別 *</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {CATEGORY_OPTIONS.map((option) => {
                    const { label, emoji } = getCategoryPresentation(option.value);
                    const isSelected = form.category === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setForm({ ...form, category: option.value })}
                        className={`rounded-xl border-2 px-3 py-2 text-left transition ${
                          isSelected
                            ? "border-amber-400 bg-amber-50 text-amber-800"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <span className="block text-sm font-bold">
                          {emoji} {label}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-tight opacity-70">
                          {option.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ここから任意項目。既定では畳んでおき、最小入力で保存できるようにする */}
              <div className="rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowOptional(!showOptional)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                >
                  <span className="text-xs font-semibold text-slate-600">
                    くわしく設定する（すべて任意）
                  </span>
                  <span className="text-xs text-slate-400">{showOptional ? "閉じる" : "開く"}</span>
                </button>

                {showOptional && (
                  <div className="space-y-3 border-t border-slate-100 px-3 py-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600">
                        いつまで連続で開催するか
                      </label>
                      <input
                        type="date"
                        value={form.end_date}
                        min={form.event_date}
                        onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        設定すると、その日までの毎週の日曜に表示されます。空欄ならこの日だけ
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-600">開始時刻</label>
                        <input
                          type="time"
                          value={form.start_time}
                          onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">終了時刻</label>
                        <input
                          type="time"
                          value={form.end_time}
                          onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600">場所</label>
                      <input
                        type="text"
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                        maxLength={200}
                        placeholder="追手筋 東エリア"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600">説明</label>
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        maxLength={1000}
                        rows={3}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600">画像</label>
                      {form.image_url ? (
                        <div className="mt-1 flex items-center gap-2">
                          {/* 管理画面のプレビューなので next/image の最適化は不要 */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={form.image_url}
                            alt="プレビュー"
                            className="h-16 w-24 rounded-lg object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, image_url: "" })}
                            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                          >
                            削除
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={uploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void handleUpload(file);
                            }}
                            className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700"
                          />
                          <p className="mt-1 text-[11px] text-slate-400">
                            {uploading ? "アップロード中..." : "JPG / PNG / WEBP・5MB以内"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={form.is_highlight}
                  onChange={(e) => setForm({ ...form, is_highlight: e.target.checked })}
                  className="mt-0.5 accent-amber-500"
                />
                <span className="text-sm text-slate-700">
                  その日の見どころにする
                  <span className="mt-0.5 block text-[11px] text-slate-400">
                    カードの主役として大きく表示されます。同じ日に1件だけ設定できます
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                  className="accent-amber-500"
                />
                <span className="text-sm text-slate-700">公開する</span>
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!form.title.trim() || !form.event_date || saving}
                className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40"
              >
                {saving ? "保存中..." : editingEvent ? "更新する" : "追加する"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={saving}
                className="flex-1 rounded-xl bg-slate-100 py-2 text-sm font-medium text-slate-700"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function EventRow({
  event,
  sundayIso,
  deleting,
  onEdit,
  onDelete,
  onTogglePublish,
}: {
  event: MarketEvent;
  /** どの日曜の枠に出しているか。null なら表示範囲外の枠 */
  sundayIso: string | null;
  deleting: boolean;
  onEdit: (event: MarketEvent) => void;
  onDelete: (event: MarketEvent) => Promise<void>;
  onTogglePublish: (event: MarketEvent) => Promise<void>;
}) {
  const publicEvent = toPublicEvent(event);
  const { label, emoji } = getCategoryPresentation(publicEvent.category);
  const time = formatEventTime(event.start_time, event.end_time);
  const isContinuous = Boolean(event.end_date && event.end_date > event.event_date);
  // 連続開催の予定は同じ内容が複数の日曜に並ぶので、どの回を見ているか分かるようにする
  const showsRepeat = isContinuous && sundayIso !== null;

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              event.is_published ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
            }`}
          >
            {event.is_published ? "公開中" : "非公開"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            {emoji} {label}
          </span>
          {event.is_highlight && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              ★ 見どころ
            </span>
          )}
          {showsRepeat && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
              連続 {formatEventPeriod(publicEvent)}
            </span>
          )}
          {sundayIso === null && (
            <span className="text-xs text-slate-400">{formatEventPeriod(publicEvent)}</span>
          )}
        </div>
        <p className="mt-1 font-semibold text-slate-900">{event.title}</p>
        {(time ?? event.location) && (
          <p className="mt-0.5 text-xs text-slate-500">
            {time}
            {time && event.location ? " · " : ""}
            {event.location}
          </p>
        )}
        {event.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{event.description}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        <button
          type="button"
          onClick={() => void onTogglePublish(event)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            event.is_published
              ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
              : "bg-green-100 text-green-800 hover:bg-green-200"
          }`}
        >
          {event.is_published ? "非公開にする" : "公開する"}
        </button>
        <button
          type="button"
          onClick={() => onEdit(event)}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
        >
          編集
        </button>
        <button
          type="button"
          onClick={() => void onDelete(event)}
          disabled={deleting}
          className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
        >
          削除
        </button>
      </div>
    </div>
  );
}
