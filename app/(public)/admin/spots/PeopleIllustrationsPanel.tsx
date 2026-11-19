"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, Surface } from "@/components/ui";
import { ILLUSTRATION_WEEKDAYS, isIllustrationImageUrl, type PeopleIllustration } from "@/lib/map/illustrations/people";
import type { FieldLocation } from "../field/components/LocationPicker";

const LocationPicker = dynamic(() => import("../field/components/LocationPicker").then((module) => module.LocationPicker), {
  ssr: false,
});
const NO_LOCATIONS: FieldLocation[] = [];
const API = "/api/admin/illustrations/people";
const FIELD_CLASS = "mt-1 block w-full rounded-btn border border-line bg-white px-3 py-2 font-normal";
type Market = { id: string; name: string; weekday: number; is_public: boolean };
type List = { people: PeopleIllustration[]; markets: Market[] };
type Editor = Omit<PeopleIllustration, "latitude" | "longitude" | "width_px"> & {
  latitude: string; longitude: string; width_px: string;
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "処理に失敗しました");
  return data as T;
}

export default function PeopleIllustrationsPanel() {
  const [list, setList] = useState<List | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void request<List>(API, { signal: controller.signal }).then(setList).catch((err: unknown) => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "取得に失敗しました");
    });
    return () => controller.abort();
  }, []);

  const latitude = Number(editor?.latitude);
  const longitude = Number(editor?.longitude);
  const location = useMemo(() => latitude >= 33.4 && latitude <= 33.7 && longitude >= 133.4 && longitude <= 133.7
    ? { lat: latitude, lng: longitude }
    : null, [latitude, longitude]);
  const marketById = new Map(list?.markets.map((market) => [market.id, market]));

  function update<K extends keyof Editor>(key: K, value: Editor[K]) {
    setEditor((current) => current ? { ...current, [key]: value } : current);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || !location || editor.weekdays.length === 0 || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { illustration } = await request<{ illustration: PeopleIllustration }>(API, {
        method: editor.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editor, latitude, longitude, width_px: Number(editor.width_px) }),
      });
      setList((current) => current && ({
        ...current,
        people: [...current.people.filter(({ id }) => id !== illustration.id), illustration]
          .sort((a, b) => a.name.localeCompare(b.name, "ja") || a.id.localeCompare(b.id)),
      }));
      setEditor(null);
      setNotice("イラストを保存しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function startEditor(person: PeopleIllustration, copyToNewLocation = false) {
    setError("");
    setNotice("");
    setEditor({
      ...person,
      id: copyToNewLocation ? "" : person.id,
      latitude: copyToNewLocation ? "" : String(person.latitude),
      longitude: copyToNewLocation ? "" : String(person.longitude),
      width_px: String(person.width_px),
    });
  }

  async function remove(person: PeopleIllustration) {
    if (busy || !window.confirm(`「${person.name}」を削除しますか？`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(`${API}?id=${encodeURIComponent(person.id)}`, { method: "DELETE" });
      setList((current) => current && ({ ...current, people: current.people.filter(({ id }) => id !== person.id) }));
      if (editor?.id === person.id) setEditor(null);
      setNotice("イラストを削除しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="people-illustrations-title" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="people-illustrations-title" className="text-lg font-bold">人のイラスト</h2>
          <p className="mt-1 text-sm text-nicchyo-ink/70">配置ごとに場所と表示曜日を設定します。</p>
        </div>
        <Button disabled={busy || !list?.markets.length} onClick={() => {
          setError("");
          setNotice("");
          const market = list?.markets[0];
          if (!market) return;
          setEditor({
            id: "", name: "", market_id: market.id, image_url: "",
            latitude: "", longitude: "", width_px: "92", enabled: true, weekdays: [market.weekday],
          });
        }}>人を追加</Button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {editor && (
        <Surface>
          <form onSubmit={(event) => void save(event)} className="space-y-4">
            <h3 className="font-bold">{editor.id ? "人のイラストを編集" : "人のイラストを追加"}</h3>
            <fieldset disabled={busy} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">管理用の名前
                  <input required maxLength={80} className={FIELD_CLASS} value={editor.name} onChange={(event) => update("name", event.target.value)} />
                </label>
                <label className="text-sm font-semibold">表示する市
                  <select required className={FIELD_CLASS} value={editor.market_id} onChange={(event) => update("market_id", event.target.value)}>
                    {list?.markets.map((market) => (
                      <option key={market.id} value={market.id}>{market.name}（{ILLUSTRATION_WEEKDAYS[market.weekday]}曜{market.is_public ? "" : "・非公開"}）</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">透過画像のURL
                  <input required maxLength={500} className={FIELD_CLASS} value={editor.image_url} onChange={(event) => update("image_url", event.target.value)} />
                </label>
                <label className="text-sm font-semibold">幅（px）
                  <input required type="number" min={16} max={200} step={1} className={FIELD_CLASS} value={editor.width_px} onChange={(event) => update("width_px", event.target.value)} />
                </label>
              </div>
              {isIllustrationImageUrl(editor.image_url) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="イラストのプレビュー" src={editor.image_url} referrerPolicy="no-referrer" className="h-20 w-24 object-contain" />
              )}
              <fieldset className="space-y-3 rounded-card border border-line p-3">
                <legend className="px-1 font-semibold">配置場所と表示曜日</legend>
                <p className="text-sm text-nicchyo-ink/70">地図をタップするか、ピンをドラッグして位置を決めます。</p>
                <LocationPicker key={editor.id} locations={NO_LOCATIONS} value={location} onChange={({ lat, lng }) => {
                  setEditor((current) => current ? { ...current, latitude: lat.toFixed(6), longitude: lng.toFixed(6) } : current);
                }} />
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-semibold">緯度
                    <input required type="number" min={33.4} max={33.7} step="any" className={FIELD_CLASS} value={editor.latitude} onChange={(event) => update("latitude", event.target.value)} />
                  </label>
                  <label className="text-sm font-semibold">経度
                    <input required type="number" min={133.4} max={133.7} step="any" className={FIELD_CLASS} value={editor.longitude} onChange={(event) => update("longitude", event.target.value)} />
                  </label>
                </div>
                <fieldset className="space-y-1">
                  <legend className="text-sm font-semibold">表示する曜日</legend>
                  <div className="flex flex-wrap gap-2">
                    {ILLUSTRATION_WEEKDAYS.map((label, day) => (
                      <label key={label} className="flex min-h-10 items-center gap-1.5 rounded-btn border border-line px-2 text-sm">
                        <input type="checkbox" checked={editor.weekdays.includes(day)} onChange={(event) => {
                          const checked = event.target.checked;
                          setEditor((current) => current && ({
                            ...current,
                            weekdays: checked ? [...current.weekdays, day] : current.weekdays.filter((value) => value !== day),
                          }));
                        }} />{label}曜
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-nicchyo-ink/70">複数選択できます。日本時間の曜日で表示し、中止・休市の日は隠します。</p>
                </fieldset>
              </fieldset>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editor.enabled} onChange={(event) => update("enabled", event.target.checked)} />地図に表示する
              </label>
            </fieldset>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || !location || editor.weekdays.length === 0}>保存</Button>
              <Button variant="quiet" disabled={busy} onClick={() => setEditor(null)}>キャンセル</Button>
            </div>
          </form>
        </Surface>
      )}
      {!list && !error && <p role="status">読み込み中…</p>}
      {list?.people.length === 0 && <p className="text-sm text-nicchyo-ink/70">人のイラストはまだありません。</p>}
      {list?.people && list.people.length > 0 && (
        <ul className="space-y-2">
          {list.people.map((person) => (
            <li key={person.id} className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" src={person.image_url} referrerPolicy="no-referrer" className="h-12 w-12 object-contain" />
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold">{person.name}</p>
                <p className="text-xs text-nicchyo-ink/70">
                  {marketById.get(person.market_id)?.name} ・ {person.weekdays.map((day) => `${ILLUSTRATION_WEEKDAYS[day]}曜`).join("・")}
                  {!person.enabled && " ・ 非表示"}
                </p>
                <p className="text-xs tabular-nums text-nicchyo-ink/70">
                  {person.latitude.toFixed(5)}, {person.longitude.toFixed(5)}
                </p>
              </div>
              <Button size="sm" variant="quiet" disabled={busy} onClick={() => startEditor(person)}>編集</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => startEditor(person, true)}>別の場所に配置</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove(person)}>削除</Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
