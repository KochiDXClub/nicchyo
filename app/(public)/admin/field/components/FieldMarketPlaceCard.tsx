"use client";
import { useCallback, useEffect, useState } from "react";
import { showToast } from "@/lib/admin/toast";
import { Card, Field, buttonClass, inputClass } from "./fieldFormParts";

type Place = { id: string; store_number: number; place_name: string | null; vendors: { id: string; name: string }[] };
type Response = { currentLocationId: string | null; places: Place[] };

export function FieldMarketPlaceCard({ shopId, updatedAt, onSaved }: { shopId: string; updatedAt: string | null; onSaved: (updatedAt: string | null) => Promise<void> }) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [locationId, setLocationId] = useState("");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/shops/${shopId}/market-place`, { cache: "no-store" });
    if (!res.ok) throw new Error("出店場所を読み込めませんでした");
    const result: Response = await res.json();
    setPlaces(result.places);
    setLocationId(result.currentLocationId ?? "");
    setName(result.places.find((p) => p.id === result.currentLocationId)?.place_name ?? "");
    setLoaded(true);
  }, [shopId]);
  useEffect(() => { void load().catch((e) => setError(e instanceof Error ? e.message : "読み込めませんでした")); }, [load]);

  async function save() {
    if (locationId && !name.trim()) { setError("出店場所名を入力してください"); return; }
    setBusy(true); setError("");
    try {
      const send = (confirmed: boolean) => fetch(`/api/admin/shops/${shopId}/market-place`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locationId: locationId || null, name: name.trim(), confirmed, updatedAt, expectedName: places.find((place) => place.id === locationId)?.place_name ?? null }) });
      let res = await send(false);
      let result = await res.json();
      if (result.needsConfirmation) {
        if (!window.confirm(`${result.error}\n（ほかに ${result.count} 店舗）`)) return;
        res = await send(true);
        result = await res.json();
      }
      if (!res.ok) throw new Error(result.error ?? "出店場所を保存できませんでした");
      await load();
      await onSaved(result.updatedAt ?? null);
      showToast.success("出店場所を保存しました");
    } catch (e) { setError(e instanceof Error ? e.message : "保存できませんでした"); }
    finally { setBusy(false); }
  }

  return <Card title="出店場所">
    <p className="text-sm text-nicchyo-ink/70">日曜市の区画と場所名を登録します。同じ区画に複数の店舗を登録できます。区画がない場合は、先にマップ編集で追加してください。既存の場所は検索して選んでください。異なる表記は同じ場所と自動判定できない場合があります。公開マップの出店中の配置もマップ編集で確認できます。</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {loaded && <>
      <Field label="区画を検索"><input className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="場所名または店番" /></Field>
      <Field label="地図の区画">
        <select className={inputClass} value={locationId} onChange={(e) => { const id = e.target.value; setLocationId(id); setName(places.find((p) => p.id === id)?.place_name ?? ""); }}>
          <option value="">未設定</option>
          {places.filter((place) => place.id === locationId || !query.trim() || String(place.store_number).includes(query.trim()) || (place.place_name ?? "").normalize("NFKC").includes(query.trim().normalize("NFKC"))).map((place) => <option key={place.id} value={place.id}>{place.place_name ? `${place.place_name}（店番 ${place.store_number}・登録 ${place.vendors.length} 店）` : `店番 ${place.store_number}（場所名なし）`}</option>)}
        </select>
      </Field>
      {locationId && <Field label="出店場所名"><input className={inputClass} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="例：一丁目 南 2" /></Field>}
      {locationId && <p className="text-sm text-nicchyo-ink/70">位置は選んだ区画と共通です。名前や位置を変更すると、この場所に登録された全店舗に反映されます。</p>}
      <button type="button" disabled={busy} onClick={() => void save()} className={`${buttonClass} bg-nicchyo-primary text-white`}>{busy ? "保存中…" : "出店場所を保存"}</button>
    </>}
  </Card>;
}
