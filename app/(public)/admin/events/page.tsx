"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader } from "@/components/admin";
import { showToast } from "@/lib/admin/toast";
import type { MarketEvent } from "@/app/api/admin/events/route";

const EMPTY_FORM = {
  title: "",
  description: "",
  event_date: "",
  start_time: "",
  end_time: "",
  location: "",
  is_published: false,
};

type EventForm = typeof EMPTY_FORM;

export default function AdminEventsPage() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();

  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MarketEvent | null>(null);
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isSuperAdmin) {
      router.push("/");
    }
  }, [isLoading, permissions.isSuperAdmin, router]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/events?all=${showAll ? "1" : "0"}`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json() as { events: MarketEvent[] };
      setEvents(data.events);
    } catch {
      showToast.error("イベントの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => {
    if (!permissions.isSuperAdmin) return;
    void fetchEvents();
  }, [fetchEvents, permissions.isSuperAdmin]);

  const openCreate = () => {
    setEditingEvent(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (event: MarketEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description ?? "",
      event_date: event.event_date,
      start_time: event.start_time ?? "",
      end_time: event.end_time ?? "",
      location: event.location ?? "",
      is_published: event.is_published,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const payload = {
      ...form,
      description: form.description || undefined,
      start_time: form.start_time || undefined,
      end_time: form.end_time || undefined,
      location: form.location || undefined,
    };

    setSaving(true);
    try {
      const url = editingEvent ? `/api/admin/events/${editingEvent.id}` : "/api/admin/events";
      const method = editingEvent ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "failed");
      }
      showToast.success(editingEvent ? "イベントを更新しました" : "イベントを作成しました");
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
      showToast.success("イベントを削除しました");
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
      <AdminPageHeader
        eyebrow="コンテンツ"
        title="イベント管理"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            + 新規作成
          </button>
        }
      />

      {/* フィルター */}
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

      {/* イベント一覧 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">読み込み中...</div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-slate-400">
          <p className="text-4xl">📅</p>
          <p className="mt-2 text-sm">イベントがありません</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            最初のイベントを作成する
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div key={event.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${event.is_published ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>
                      {event.is_published ? "公開中" : "非公開"}
                    </span>
                    <span className="text-xs text-slate-500">{event.event_date}</span>
                    {(event.start_time ?? event.end_time) && (
                      <span className="text-xs text-slate-400">
                        {event.start_time ?? ""}{event.end_time ? ` 〜 ${event.end_time}` : ""}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-semibold text-slate-900">{event.title}</p>
                  {event.location && <p className="mt-0.5 text-xs text-slate-500">📍 {event.location}</p>}
                  {event.description && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">{event.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleTogglePublish(event)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${event.is_published ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-green-100 text-green-800 hover:bg-green-200"}`}
                  >
                    {event.is_published ? "非公開にする" : "公開する"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(event)}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(event)}
                    disabled={deletingId === event.id}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 作成・編集モーダル */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10"
          onClick={() => !saving && setShowForm(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-slate-900">{editingEvent ? "イベントを編集" : "新規イベント作成"}</h2>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">タイトル *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  maxLength={100}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">開催日 *</label>
                <input
                  type="date"
                  value={form.event_date}
                  onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                />
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
                  placeholder="高知城前・追手筋など"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">説明</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  maxLength={1000}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>
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
                {saving ? "保存中..." : editingEvent ? "更新する" : "作成する"}
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
