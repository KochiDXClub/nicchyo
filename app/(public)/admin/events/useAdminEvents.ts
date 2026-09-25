import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { showToast } from "@/lib/admin/toast";
import {
  getUpcomingSundayIso,
  isEventOnSunday,
  normalizeCategory,
  normalizeHighlightDates,
  type MarketEventCategory,
} from "@/lib/market/calendar";
import type { MarketEvent } from "@/app/api/admin/events/route";
import { toPublicEvent } from "./EventRow";

/** 管理画面に並べる日曜の数 */
export const SUNDAY_COUNT = 8;

export const CATEGORY_OPTIONS: { value: MarketEventCategory; hint: string }[] = [
  { value: "season", hint: "今が旬のもの" },
  { value: "vendor", hint: "特別出店・出店予定" },
  { value: "event", hint: "催し・まつり" },
  { value: "notice", hint: "そのほかの連絡" },
];

export type EventForm = {
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
  /** 見どころにする週（日曜の日付）の一覧。連続開催の一部の週だけを選べる */
  highlight_dates: string[];
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
    highlight_dates: [],
  };
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 日曜市カレンダー予定の入稿画面（/admin/events）の状態一式。
 *
 * 取得・日曜ごとの束ね直し、フォームの開閉・編集・保存・削除・公開切り替え、
 * 画像アップロードまで、この画面が持つ状態と操作をすべてここに集約する。
 * 画面（page.tsx）側はこれを呼び、返ってきた値をそのまま表示に使うだけにする。
 */
export function useAdminEvents({ isAdmin }: { isAdmin: boolean }) {
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
    if (!isAdmin) return;
    void fetchEvents();
  }, [fetchEvents, isAdmin]);

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

  /**
   * 過去の投稿を下書きとして流用する。
   *
   * 出店者の再投稿機能とは違い、選んだ瞬間に投稿されることはない。
   * フォームの内容欄だけを埋め、日付・連続期間・見どころ・公開設定は
   * 毎回選び直す前提で空のままにする（雨天中止のような繰り返し告知でも
   * 「その日」の情報として毎回確認してから出す）。
   */
  const applyHistoryTemplate = (source: MarketEvent) => {
    setForm((prev) => ({
      ...prev,
      title: source.title,
      description: source.description ?? "",
      category: normalizeCategory(source.category),
      image_url: source.image_url ?? "",
      location: source.location ?? "",
      start_time: source.start_time ?? "",
      end_time: source.end_time ?? "",
    }));
    if (source.location || source.start_time || source.end_time) {
      setShowOptional(true);
    }
    showToast.success("過去の投稿を下書きに反映しました。内容を確認して投稿してください");
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
      highlight_dates: normalizeHighlightDates(event.highlight_dates),
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

  return {
    events,
    loading,
    showForm,
    setShowForm,
    editingEvent,
    form,
    setForm,
    saving,
    deletingId,
    showAll,
    setShowAll,
    uploading,
    showOptional,
    setShowOptional,
    fileInputRef,
    sundays,
    outOfRange,
    openCreate,
    applyHistoryTemplate,
    openEdit,
    handleUpload,
    handleSave,
    handleDelete,
    handleTogglePublish,
  };
}
