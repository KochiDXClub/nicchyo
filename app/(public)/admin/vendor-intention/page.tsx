"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminLayout, AdminPageHeader } from "@/components/admin";
import type { IntentionSeason } from "@/lib/vendor/intention";
import { seasonStatus, type SeasonStatus } from "@/lib/vendor/intentionSeasonAdmin";

const STATUS_LABELS: Record<SeasonStatus, string> = {
  upcoming: "受付前",
  open: "受付中",
  closed: "受付終了",
};

const STATUS_CLASSES: Record<SeasonStatus, string> = {
  upcoming: "bg-amber-100 text-amber-800",
  open: "bg-emerald-100 text-emerald-800",
  closed: "bg-nicchyo-ink/10 text-nicchyo-ink",
};

const EMPTY_FORM = { title: "", opensOn: "", closesOn: "" };

/** 出店意向調査の受付期間（季節）を作る・今すぐ開く・今すぐ閉じる */
export default function AdminVendorIntentionPage() {
  const [seasons, setSeasons] = useState<IntentionSeason[]>([]);
  const [today, setToday] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/vendor-intention-seasons", { cache: "no-store" });
    const body = (await response.json().catch(() => ({}))) as { seasons?: IntentionSeason[]; today?: string; error?: string };
    if (!response.ok) {
      setError(body.error ?? "季節の一覧を読み込めませんでした");
      return;
    }
    setSeasons(body.seasons ?? []);
    setToday(body.today ?? "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/admin/vendor-intention-seasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        opensOn: form.opensOn,
        closesOn: form.closesOn,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "季節を作れませんでした");
      return;
    }
    setForm(EMPTY_FORM);
    setNotice("受付期間を作りました。開始日になると、出店者の画面で回答を受け付けます。");
    await load();
  };

  const changeStatus = async (season: IntentionSeason, action: "open" | "close") => {
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch(`/api/admin/vendor-intention-seasons/${season.seasonYear}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "受付の状態を変えられませんでした");
      return;
    }
    setNotice(action === "open" ? `${season.seasonYear}年の受付を開きました。` : `${season.seasonYear}年の受付を閉じました。`);
    await load();
  };

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="Vendor intention"
        title="出店意向調査"
        description="来季の出店意向を出店者から集める受付期間を作り、今すぐ開く・閉じるを切り替えます（日付は日本時間）"
      />
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-5">
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

        <section aria-labelledby="season-list" className="space-y-2">
          <h2 id="season-list" className="text-lg font-bold">受付期間の一覧</h2>
          {seasons.length === 0 ? (
            <p className="rounded-lg border bg-white p-3 text-sm text-nicchyo-ink/70">まだ受付期間がありません。下のフォームから作ってください。</p>
          ) : (
            <ul className="divide-y rounded-lg border bg-white">
              {seasons.map((season) => {
                const status = seasonStatus(season, today || season.opensOn);
                return (
                  <li key={season.seasonYear} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div>
                      <p className="flex items-center gap-2 font-bold">
                        {season.seasonYear}年 {season.title}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span>
                      </p>
                      <p className="text-sm text-nicchyo-ink/70">
                        {season.opensOn} 〜 {season.closesOn}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {status !== "open" && (
                        <button type="button" disabled={busy} className="rounded-lg bg-nicchyo-primary px-3 py-1 text-sm font-bold disabled:opacity-50" onClick={() => void changeStatus(season, "open")}>
                          今すぐ受付を開く
                        </button>
                      )}
                      {status !== "closed" && (
                        <button type="button" disabled={busy} className="rounded-lg border px-3 py-1 text-sm font-bold disabled:opacity-50" onClick={() => void changeStatus(season, "close")}>
                          今すぐ受付を閉じる
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="season-form" className="space-y-3 rounded-lg border bg-white p-4">
          <h2 id="season-form" className="text-lg font-bold">受付期間を作る</h2>
          <label className="block text-sm font-bold">
            名前（例: 2027年 来季の出店意向）
            <input className="mt-1 w-full rounded-lg border px-3 py-2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} />
          </label>
          <label className="block text-sm font-bold">
            受付の開始日
            <input type="date" className="mt-1 w-full rounded-lg border px-3 py-2" value={form.opensOn} onChange={(e) => setForm({ ...form, opensOn: e.target.value })} />
          </label>
          <label className="block text-sm font-bold">
            受付の締切日（この日まで回答を変更できます）
            <input type="date" className="mt-1 w-full rounded-lg border px-3 py-2" value={form.closesOn} onChange={(e) => setForm({ ...form, closesOn: e.target.value })} />
          </label>
          <p className="text-xs text-nicchyo-ink/70">既存の受付期間と日付が重なると作れません。</p>
          <button type="button" disabled={busy} className="rounded-lg bg-nicchyo-primary px-4 py-2 font-bold disabled:opacity-50" onClick={() => void submit()}>
            作成する
          </button>
        </section>
      </main>
    </AdminLayout>
  );
}
