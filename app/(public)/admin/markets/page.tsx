"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminLayout, AdminPageHeader } from "@/components/admin";
import { DEFAULT_MARKET_MARKER_COLOR, resolveMarkerColor } from "@/lib/market/markerColor";

type Market = {
  id: string;
  slug: string;
  name: string;
  weekday: number;
  is_public: boolean;
  marker_color?: string;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const EMPTY_FORM = { name: "", slug: "", weekday: 0, isPublic: false, markerColor: DEFAULT_MARKET_MARKER_COLOR };

/** 市の一覧・登録・編集（コードを変えずに市を増やすための管理画面） */
export default function AdminMarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/markets", { cache: "no-store" });
    const body = (await response.json().catch(() => ({}))) as { markets?: Market[]; error?: string };
    if (!response.ok) {
      setError(body.error ?? "市の一覧を読み込めません");
      return;
    }
    setMarkets(body.markets ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (market: Market) => {
    setEditingId(market.id);
    setForm({ name: market.name, slug: market.slug, weekday: market.weekday, isPublic: market.is_public, markerColor: resolveMarkerColor(market.marker_color) });
    setNotice("");
    setError("");
  };

  const reset = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/markets", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "保存に失敗しました");
        return;
      }
      setNotice(editingId ? "市を更新しました" : "市を登録しました");
      reset();
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader eyebrow="Markets" title="市の管理" description="市の名前・公開URL・開催曜日・マーカーの色・公開の有無を登録・編集します" />
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-5">
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

        <section aria-labelledby="markets-list" className="space-y-2">
          <h2 id="markets-list" className="text-lg font-bold">登録されている市</h2>
          <ul className="divide-y rounded-lg border bg-white">
            {markets.map((market) => (
              <li key={market.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="flex items-center gap-2 font-bold">
                    <span aria-hidden className="inline-block h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: resolveMarkerColor(market.marker_color) }} />
                    {market.name}
                  </p>
                  <p className="text-sm text-nicchyo-ink/70">
                    /{market.slug} ・ 毎週{WEEKDAYS[market.weekday]}曜 ・ {market.is_public ? "公開中" : "非公開"}
                  </p>
                </div>
                <button type="button" className="rounded-lg border px-3 py-1 text-sm font-bold" onClick={() => startEdit(market)}>
                  編集
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="market-form" className="space-y-3 rounded-lg border bg-white p-4">
          <h2 id="market-form" className="text-lg font-bold">{editingId ? "市を編集" : "市を登録"}</h2>
          <label className="block text-sm font-bold">
            市の名前（例: 火曜市）
            <input className="mt-1 w-full rounded-lg border px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={40} />
          </label>
          <label className="block text-sm font-bold">
            公開URLの名前（英小文字。例: kayo）
            <input className="mt-1 w-full rounded-lg border px-3 py-2" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} maxLength={32} />
          </label>
          <label className="block text-sm font-bold">
            開催曜日
            <select className="mt-1 w-full rounded-lg border px-3 py-2" value={form.weekday} onChange={(e) => setForm({ ...form, weekday: Number(e.target.value) })}>
              {WEEKDAYS.map((label, index) => (
                <option key={label} value={index}>{label}曜</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold">
            地図のマーカーの色
            <span className="mt-1 flex items-center gap-3">
              <input type="color" aria-label="地図のマーカーの色" disabled={form.slug === "nichiyo"} className="h-10 w-16 cursor-pointer rounded-lg border disabled:cursor-not-allowed disabled:opacity-50" value={form.markerColor} onChange={(e) => setForm({ ...form, markerColor: e.target.value.toUpperCase() })} />
              <span className="text-sm font-normal text-nicchyo-ink/70">{form.markerColor}（マップ編集で、この市の出店位置がこの色で表示されます）</span>
            </span>
            <span className="mt-1 block text-xs font-normal text-nicchyo-ink/70">
              {form.slug === "nichiyo"
                ? "日曜市は従来の色で表示するため、変更できません。"
                : "赤系（空き区画）と、青（保存していない変更の印）は見分けにくくなるため避けてください。"}
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} />
            一般の利用者に公開する
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={busy} className="rounded-lg bg-nicchyo-primary px-4 py-2 font-bold disabled:opacity-50" onClick={() => void submit()}>
              {editingId ? "更新する" : "登録する"}
            </button>
            {editingId && (
              <button type="button" className="rounded-lg border px-4 py-2 font-bold" onClick={reset}>
                編集をやめる
              </button>
            )}
          </div>
        </section>
      </main>
    </AdminLayout>
  );
}
