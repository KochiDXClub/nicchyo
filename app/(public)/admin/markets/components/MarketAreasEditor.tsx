"use client";

import { useCallback, useEffect, useState } from "react";
import { moveMarketAreaIds, parseMarketAreaLabel, sortMarketAreas, type MarketArea, MARKET_AREA_LABEL_MAX_LENGTH } from "@/lib/market/marketAreas";

/**
 * 市の丁目（区画のエリア）の追加・名前変更・並べ替え・削除。
 * 名前を変えると、この市の区画の丁目も同じ名前に変わる。区画が使っている丁目は削除できない。
 */
export default function MarketAreasEditor({ marketId, marketName }: { marketId: string; marketName: string }) {
  const [areas, setAreas] = useState<MarketArea[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/market-areas?marketId=${encodeURIComponent(marketId)}`, { cache: "no-store" });
    const body = (await response.json().catch(() => ({}))) as { areas?: MarketArea[]; error?: string };
    if (!response.ok) {
      setError(body.error ?? "丁目の一覧を読み込めません");
      return;
    }
    setAreas(sortMarketAreas(body.areas ?? []));
    setDrafts({});
  }, [marketId]);

  useEffect(() => {
    setNotice("");
    setError("");
    void load();
  }, [load]);

  /** 変更の送信。成功したら一覧を読み直す（サーバーの並びを正とする） */
  const send = async (method: "POST" | "PATCH" | "PUT" | "DELETE", payload: Record<string, unknown>, done: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/market-areas", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "保存に失敗しました");
        await load();
        return false;
      }
      setNotice(done);
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const parsed = parseMarketAreaLabel(newLabel);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (await send("POST", { marketId, label: parsed.label }, `「${parsed.label}」を追加しました`)) setNewLabel("");
  };

  const rename = async (area: MarketArea) => {
    const parsed = parseMarketAreaLabel(drafts[area.id] ?? area.label);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (parsed.label === area.label) return;
    if (!window.confirm(`「${area.label}」を「${parsed.label}」に変えます。この市の区画の丁目も変わります。続けますか？`)) return;
    await send("PATCH", { id: area.id, label: parsed.label }, `「${parsed.label}」に名前を変えました`);
  };

  const move = async (area: MarketArea, direction: -1 | 1) => {
    const next = moveMarketAreaIds(areas.map((item) => item.id), area.id, direction);
    if (!next) return;
    await send("PUT", { marketId, ids: next }, "並び順を変えました");
  };

  const remove = async (area: MarketArea) => {
    if (!window.confirm(`「${area.label}」を削除します。続けますか？`)) return;
    await send("DELETE", { id: area.id }, `「${area.label}」を削除しました`);
  };

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

      {areas.length === 0 ? (
        <p className="text-sm text-nicchyo-ink/70">{marketName}の丁目はまだありません。下から追加してください。</p>
      ) : (
        <ol className="divide-y rounded-lg border bg-white">
          {areas.map((area, index) => {
            const draft = drafts[area.id] ?? area.label;
            return (
              <li key={area.id} className="flex flex-wrap items-center gap-2 p-3">
                <span className="w-8 text-sm text-nicchyo-ink/70">{index + 1}.</span>
                <label className="flex-1 text-sm font-bold">
                  <span className="sr-only">丁目の名前</span>
                  <input
                    className="w-full rounded-lg border px-3 py-1.5"
                    value={draft}
                    maxLength={MARKET_AREA_LABEL_MAX_LENGTH}
                    onChange={(e) => setDrafts({ ...drafts, [area.id]: e.target.value })}
                  />
                </label>
                <button type="button" disabled={busy || draft.trim() === area.label} className="rounded-lg border px-3 py-1 text-sm font-bold disabled:opacity-40" onClick={() => void rename(area)}>
                  名前を変える
                </button>
                <button type="button" disabled={busy || index === 0} className="rounded-lg border px-3 py-1 text-sm font-bold disabled:opacity-40" onClick={() => void move(area, -1)}>
                  上へ
                </button>
                <button type="button" disabled={busy || index === areas.length - 1} className="rounded-lg border px-3 py-1 text-sm font-bold disabled:opacity-40" onClick={() => void move(area, 1)}>
                  下へ
                </button>
                <button type="button" disabled={busy} className="rounded-lg border border-red-300 px-3 py-1 text-sm font-bold text-red-800 disabled:opacity-40" onClick={() => void remove(area)}>
                  削除
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-white p-3">
        <label className="flex-1 text-sm font-bold">
          丁目の名前を追加（例: 一丁目、1丁目）
          <input className="mt-1 w-full rounded-lg border px-3 py-2" value={newLabel} maxLength={MARKET_AREA_LABEL_MAX_LENGTH} onChange={(e) => setNewLabel(e.target.value)} />
        </label>
        <button type="button" disabled={busy || newLabel.trim() === ""} className="rounded-lg bg-nicchyo-primary px-4 py-2 text-sm font-bold disabled:opacity-40" onClick={() => void add()}>
          追加
        </button>
      </div>
    </div>
  );
}
