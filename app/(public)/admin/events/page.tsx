"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader } from "@/components/admin";
import { formatEventDate, getCategoryPresentation, getRelativeSundayLabel } from "@/lib/market/calendar";
import { useAdminEvents, CATEGORY_OPTIONS, SUNDAY_COUNT } from "./useAdminEvents";
import { EventRow } from "./EventRow";
import { HistoryTemplatePicker } from "./HistoryTemplatePicker";
import { HighlightWeekPicker } from "./HighlightWeekPicker";

export default function AdminEventsPage() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isAdmin) router.push("/");
  }, [isLoading, permissions.isAdmin, router]);

  const e = useAdminEvents({ isAdmin: permissions.isAdmin });

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
            checked={e.showAll}
            onChange={(ev) => e.setShowAll(ev.target.checked)}
            className="accent-amber-500"
          />
          非公開も表示する
        </label>
      </div>

      {e.loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">読み込み中...</div>
      ) : (
        <div className="space-y-3">
          {e.sundays.map(({ dateIso, weeksAhead, items }) => (
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
                  onClick={() => e.openCreate(dateIso)}
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
                      deleting={e.deletingId === event.id}
                      onEdit={e.openEdit}
                      onDelete={e.handleDelete}
                      onTogglePublish={e.handleTogglePublish}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

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
                    onEdit={e.openEdit}
                    onDelete={e.handleDelete}
                    onTogglePublish={e.handleTogglePublish}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {e.showForm && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10"
          onClick={() => !e.saving && e.setShowForm(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 className="font-bold text-slate-900">
              {e.editingEvent ? "予定を編集" : `${formatEventDate(e.form.event_date)} に追加`}
            </h2>

            <div className="mt-4 space-y-4">
              {/* 新規追加のときだけ、過去の投稿を下書きとして呼び出せる。
                  編集中はすでに内容があるので出さない。 */}
              {!e.editingEvent && (
                <HistoryTemplatePicker events={e.events} onSelect={e.applyHistoryTemplate} />
              )}

              <div>
                <label className="text-xs font-semibold text-slate-600">タイトル *</label>
                <input
                  type="text"
                  value={e.form.title}
                  onChange={(ev) => e.setForm({ ...e.form, title: ev.target.value })}
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
                    const isSelected = e.form.category === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => e.setForm({ ...e.form, category: option.value })}
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
                  onClick={() => e.setShowOptional(!e.showOptional)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                >
                  <span className="text-xs font-semibold text-slate-600">
                    くわしく設定する（すべて任意）
                  </span>
                  <span className="text-xs text-slate-400">{e.showOptional ? "閉じる" : "開く"}</span>
                </button>

                {e.showOptional && (
                  <div className="space-y-3 border-t border-slate-100 px-3 py-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600">
                        いつまで連続で開催するか
                      </label>
                      <input
                        type="date"
                        value={e.form.end_date}
                        min={e.form.event_date}
                        onChange={(ev) => e.setForm({ ...e.form, end_date: ev.target.value })}
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
                          value={e.form.start_time}
                          onChange={(ev) => e.setForm({ ...e.form, start_time: ev.target.value })}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">終了時刻</label>
                        <input
                          type="time"
                          value={e.form.end_time}
                          onChange={(ev) => e.setForm({ ...e.form, end_time: ev.target.value })}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600">場所</label>
                      <input
                        type="text"
                        value={e.form.location}
                        onChange={(ev) => e.setForm({ ...e.form, location: ev.target.value })}
                        maxLength={200}
                        placeholder="追手筋 東エリア"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600">説明</label>
                      <textarea
                        value={e.form.description}
                        onChange={(ev) => e.setForm({ ...e.form, description: ev.target.value })}
                        maxLength={1000}
                        rows={3}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600">画像</label>
                      {e.form.image_url ? (
                        <div className="mt-1 flex items-center gap-2">
                          {/* 管理画面のプレビューなので next/image の最適化は不要 */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={e.form.image_url}
                            alt="プレビュー"
                            className="h-16 w-24 rounded-lg object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => e.setForm({ ...e.form, image_url: "" })}
                            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                          >
                            削除
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1">
                          <input
                            ref={e.fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={e.uploading}
                            onChange={(ev) => {
                              const file = ev.target.files?.[0];
                              if (file) void e.handleUpload(file);
                            }}
                            className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700"
                          />
                          <p className="mt-1 text-[11px] text-slate-400">
                            {e.uploading ? "アップロード中..." : "JPG / PNG / WEBP・5MB以内"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <HighlightWeekPicker
                eventDate={e.form.event_date}
                endDate={e.form.end_date || null}
                selected={e.form.highlight_dates}
                onChange={(highlight_dates) => e.setForm({ ...e.form, highlight_dates })}
              />

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={e.form.is_published}
                  onChange={(ev) => e.setForm({ ...e.form, is_published: ev.target.checked })}
                  className="accent-amber-500"
                />
                <span className="text-sm text-slate-700">公開する</span>
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => void e.handleSave()}
                disabled={!e.form.title.trim() || !e.form.event_date || e.saving}
                className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40"
              >
                {e.saving ? "保存中..." : e.editingEvent ? "更新する" : "追加する"}
              </button>
              <button
                type="button"
                onClick={() => e.setShowForm(false)}
                disabled={e.saving}
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
