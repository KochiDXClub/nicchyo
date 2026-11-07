"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, MapPin, Store } from "lucide-react";
import { AdminLayout, AdminPageHeader } from "@/components/admin";
import { useAuth } from "@/lib/auth/AuthContext";
import { ShopPreview } from "@/components/admin/ShopPreview";
import { SchedulePlaceMap } from "./components/SchedulePlaceMap";
import { formatMarketAddress } from "@/lib/market-schedule/address";
import { todayJstString, addDaysToDateString, nextSundayJstString } from "@/lib/time/jstDate";
import { sundaysBetween } from "@/lib/market-schedule/calendar";
import { resolveSchedule } from "@/lib/market-schedule/resolve";
import type { ScheduleAdminData } from "@/lib/market-schedule/adminTypes";

const control = "min-h-11 w-full rounded-btn border border-line bg-white px-3 py-2 text-base text-nicchyo-ink outline-none focus:border-nicchyo-primary focus:ring-2 focus:ring-nicchyo-primary/20";
const button = buttonClass({ variant: "primary", shape: "soft" });
const section = "scroll-mt-5 space-y-4 rounded-card bg-white p-4 shadow-card ring-1 ring-line sm:p-6";
function placeLabel(place: ScheduleAdminData["places"][number]) {
  const address = place.official_number == null ? `住所未設定（区画 ${place.store_number}）` : `住所 ${formatMarketAddress({ main: place.official_number, branch: place.branch_number })}`;
  return [place.district, place.place_name, address].filter(Boolean).join(" / ");
}

export default function MarketSchedulePage() {
  const { permissions, isLoading } = useAuth();
  const [data, setData] = useState<ScheduleAdminData | null>(null);
  const [publicEnabled, setPublicEnabled] = useState<boolean | null>(null);
  const [location, setLocation] = useState("");
  const [vendor, setVendor] = useState("");
  const [membership, setMembership] = useState("");
  const [viewStart, setViewStart] = useState("");
  const [memberStart, setMemberStart] = useState("");
  const [ruleStart, setRuleStart] = useState("");
  const [cadence, setCadence] = useState<"weekly" | "fortnightly" | "monthly">("weekly");
  const [weeks, setWeeks] = useState<number[]>([1, 3]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [endDates, setEndDates] = useState<Record<string, string>>({});
  const [previewVendor, setPreviewVendor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/market-schedule", { cache: "no-store" });
    if (!response.ok) throw new Error("出店予定を取得できませんでした");
    const next = await response.json() as ScheduleAdminData;
    setData(next);
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("location");
    const requestedVendor = params.get("vendor");
    const vendorPlace = next.memberships.find((item) => item.vendor_id === requestedVendor)?.location_id;
    setLocation((current) => current || (requested && next.places.some((place) => place.id === requested) ? requested : "") || vendorPlace || next.places[0]?.id || "");
    setVendor((current) => current || new URLSearchParams(window.location.search).get("vendor") || "");
  }, []);
  useEffect(() => {
    if (!permissions.isAdmin) return;
    void load().catch((e) => setError(e instanceof Error ? e.message : "読み込めませんでした"));
    void fetch("/api/admin/public-schedule", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("公開設定を取得できませんでした");
      const value = await response.json() as { enabled?: unknown };
      setPublicEnabled(typeof value.enabled === "boolean" ? value.enabled : null);
    }).catch(() => setPublicEnabled(null));
    setMemberStart(todayJstString());
    setViewStart(nextSundayJstString());
    setRuleStart(nextSundayJstString());
  }, [load, permissions.isAdmin]);

  const locations = useMemo(() => [...(data?.places ?? [])].sort((a, b) => (a.official_number ?? a.store_number) - (b.official_number ?? b.store_number) || (a.branch_number ?? 0) - (b.branch_number ?? 0)), [data]);
  const locationMembers = useMemo(() => (data?.memberships ?? []).filter((item) => item.location_id === location), [data, location]);
  const vendorName = useCallback((id: string) => data?.vendors.find((item) => item.id === id)?.shop_name || "名称未設定", [data]);
  const dates = useMemo(() => viewStart ? sundaysBetween(viewStart, addDaysToDateString(viewStart, 41)) : [], [viewStart]);
  const plan = useMemo(() => {
    if (!data) return [];
    return dates.flatMap((day) => resolveSchedule(data, day).filter((item) => item.locationId === location));
  }, [data, dates, location]);
  const selectedPlace = useMemo(() => locations.find((place) => place.id === location), [locations, location]);
  const conflicts = plan.filter((item) => item.state === "conflict").length;
  const vendorPlan = useMemo(() => {
    if (!data || !vendor) return [];
    return dates.map((day) => ({ date: day, marketClosed: data.marketDays?.some((item) => item.market_date === day && (item.status === "cancelled" || item.status === "closed")) ?? false, places: resolveSchedule(data, day).filter((item) => item.vendorIds.includes(vendor)) }));
  }, [data, dates, vendor]);
  const legacyPlaces = useMemo(() => {
    if (!data || !vendor) return [];
    const latest = new Map<string, string>();
    for (const item of data.legacyAssignments ?? []) {
      if (item.vendor_id !== vendor || data.memberships.some((member) => member.vendor_id === vendor && member.location_id === item.location_id)) continue;
      if (!latest.has(item.location_id) || item.market_date > latest.get(item.location_id)!) latest.set(item.location_id, item.market_date);
    }
    const oldLocation = data.vendors.find((item) => item.id === vendor)?.market_place_id;
    if (oldLocation && !data.memberships.some((member) => member.vendor_id === vendor && member.location_id === oldLocation) && !latest.has(oldLocation)) latest.set(oldLocation, "");
    return [...latest.entries()];
  }, [data, vendor]);

  const selectLocation = useCallback((id: string) => { setLocation(id); setMembership(""); setPreviewVendor(null); }, []);

  async function mutate(body: Record<string, unknown>, allowConfirmation = false) {
    setBusy(true); setError(""); setNotice("");
    try {
      const send = (payload: Record<string, unknown>) => fetch("/api/admin/market-schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      let response = await send(body);
      let result = await response.json() as { error?: string; needsConfirmation?: boolean; count?: number };
      if (allowConfirmation && result.needsConfirmation) {
        if (!window.confirm(`${result.error}\n（ほかに ${result.count ?? 0} 店舗）`)) return;
        response = await send({ ...body, confirmed: true, seenCount: result.count });
        result = await response.json();
      }
      if (!response.ok) throw new Error(result.error ?? "保存できませんでした");
      await load();
      setNotice("保存しました。予定に競合がないか確認してください。");
    } catch (e) { setError(e instanceof Error ? e.message : "保存できませんでした"); }
    finally { setBusy(false); }
  }

  if (isLoading || !permissions.isAdmin) return null;
  return <AdminLayout><AdminPageHeader eyebrow="Schedule" title="出店予定管理" description="場所ごと・店舗ごとに出店予定を確認します" />
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-7">
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-btn px-4 py-3 ring-1 ${publicEnabled === true ? "bg-status-good-bg text-status-good-fg ring-status-good-line" : "bg-status-warning-bg text-status-warning-fg ring-status-warning-line"}`}>
        <div className="flex min-w-0 items-start gap-3">{publicEnabled === true ? <CheckCircle2 size={19} className="mt-0.5 shrink-0" aria-hidden /> : <AlertCircle size={19} className="mt-0.5 shrink-0" aria-hidden />}<div><p className="text-sm font-bold">{publicEnabled === null ? "公開状態を確認できません" : publicEnabled ? "出店予定を公開中" : "出店予定は公開前です"}</p><p className="mt-0.5 text-xs leading-relaxed">{publicEnabled === null ? "変更前に公開設定を確認してください。" : publicEnabled ? "変更は公開マップに反映されます。" : "ここで登録した予定はまだ公開マップには反映されません。"}</p></div></div>
        <Link className="inline-flex min-h-10 items-center gap-1 text-sm font-bold underline underline-offset-4" href="/admin/legacy-shop-identities">公開設定 <ArrowRight size={15} aria-hidden /></Link>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm">{notice}</p>}
      {!data ? !error && <p role="status" className="py-8 text-center text-sm text-nicchyo-ink/70">出店予定を読み込んでいます…</p> : <>
        <nav aria-label="出店予定管理の操作" className="flex gap-2 overflow-x-auto pb-1 text-sm font-bold"><a className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-chip bg-white px-4 text-nicchyo-ink ring-1 ring-line" href="#place"><MapPin size={16} aria-hidden />場所を選ぶ</a><a className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-chip bg-white px-4 text-nicchyo-ink ring-1 ring-line" href="#upcoming"><CalendarDays size={16} aria-hidden />直近の予定</a><a className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-chip bg-white px-4 text-nicchyo-ink ring-1 ring-line" href="#members"><Store size={16} aria-hidden />店舗登録</a><a className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-chip bg-white px-4 text-nicchyo-ink ring-1 ring-line" href="#recurrence"><CalendarDays size={16} aria-hidden />繰り返し予定</a></nav>
        <section id="place" className={section}>
          <div><p className="text-xs font-bold tracking-wider text-amber-800">STEP 01</p><h2 className="mt-1 text-xl font-bold">出店場所を選ぶ</h2><p className="mt-1 text-sm text-nicchyo-ink/70">地図のピン、または一覧から場所を選択してください。</p></div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(250px,1fr)]">
            <div className="order-2 lg:order-1"><SchedulePlaceMap places={locations} selected={location} onSelect={selectLocation} /></div>
            <div className="order-1 space-y-4 rounded-btn bg-nicchyo-base p-4 lg:order-2">
              <label className="block text-sm font-bold">場所を選ぶ<select className={`${control} mt-1`} value={location} onChange={(e) => selectLocation(e.target.value)}><option value="">場所を選択</option>{locations.map((place) => <option key={place.id} value={place.id}>{placeLabel(place)}</option>)}</select></label>
              <div className="border-t border-line-warm pt-4"><p className="text-xs font-bold text-nicchyo-ink/55">選択中の場所</p><p className="mt-1 break-words text-base font-bold">{selectedPlace ? placeLabel(selectedPlace) : "場所を選択してください"}</p><p className="mt-2 text-sm text-nicchyo-ink/70">登録履歴のある店舗 {locationMembers.length} 件</p></div><p className="text-sm leading-relaxed text-nicchyo-ink/70">店舗情報の編集は現場登録、住所や地図上の位置はマップ編集で行います。</p>
              <Link className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-amber-800 underline underline-offset-4" href="/admin/map-edit">マップ編集を開く <ArrowRight size={15} aria-hidden /></Link>
            </div>
          </div>
        </section>
        <section id="upcoming" className={section}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-wider text-amber-800">STEP 02</p><h2 className="mt-1 text-xl font-bold">直近の予定</h2><p className="mt-1 text-sm text-nicchyo-ink/70">{locations.find((place) => place.id === location) ? placeLabel(locations.find((place) => place.id === location)!) : "場所を選択してください"} · 約６週間分</p></div><label className="text-sm font-bold">表示開始日<input type="date" className={`${control} mt-1`} value={viewStart} onChange={(event) => setViewStart(event.target.value)} /></label></div><div className="flex flex-wrap items-center justify-between gap-2 rounded-btn bg-nicchyo-base px-4 py-3 text-sm"><p className="text-nicchyo-ink/70">特定の日だけ、出店する店舗や休みを変更できます。</p>{conflicts > 0 && <strong className="text-status-critical-fg">{conflicts} 日の予定が競合しています</strong>}</div>
          {plan.length === 0 && <p className="rounded-btn bg-nicchyo-base p-4 text-sm text-nicchyo-ink/70">場所と表示開始日を選ぶと、直近の予定が表示されます。</p>}
          {plan.map((item) => { const override = data.overrides.find((entry) => entry.location_id === location && entry.market_date === item.date); return <div key={item.date} className="grid items-center gap-2 border-t border-line py-4 sm:grid-cols-[140px_minmax(0,1fr)_220px]"><strong>{item.date}（日）</strong><span className={item.state === "conflict" ? "font-bold text-amber-800" : item.state === "scheduled" ? "font-bold text-nicchyo-ink" : "text-nicchyo-ink/70"}>{item.state === "conflict" ? "予定が競合しています" : item.state === "market_closed" ? "日曜市は中止・休み" : item.state === "closed" ? "休み" : item.state === "unplanned" ? "未設定" : item.vendorIds.map(vendorName).join("、")} {item.source === "override" ? "（この日だけ）" : ""}</span><label className="text-sm">この日の変更<select className={`${control} mt-1`} disabled={busy} value={override && !override.is_cleared ? override.membership_id ?? "closed" : "rule"} onChange={(e) => { const value = e.target.value; void mutate({ action: "override", locationId: location, date: item.date, membershipId: value === "closed" || value === "rule" ? null : value, mode: value === "rule" ? "clear" : "set", expected: override?.revision ?? null }); }}><option value="rule">繰り返しに従う</option><option value="closed">休み</option>{locationMembers.map((member) => <option key={member.id} value={member.id}>店舗{member.vendor_number}：{vendorName(member.vendor_id)}</option>)}</select></label></div>; })}
        </section>
        <section id="members" className={section}>
          <div><p className="text-xs font-bold tracking-wider text-amber-800">STEP 03</p><h2 className="mt-1 text-xl font-bold">この場所に店舗を登録</h2><p className="mt-1 text-sm text-nicchyo-ink/70">まず店舗を登録してから、繰り返しの出店予定を設定します。</p></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-bold">店舗<select className={`${control} mt-1`} value={vendor} onChange={(e) => setVendor(e.target.value)}><option value="">店舗を選択</option>{[...data.vendors].sort((a,b) => (a.shop_name ?? "").localeCompare(b.shop_name ?? "", "ja")).map((item) => <option key={item.id} value={item.id}>{item.shop_name || "名称未設定"}</option>)}</select></label>
            <label className="block text-sm font-bold">登録開始日<input type="date" className={`${control} mt-1`} value={memberStart} onChange={(e) => setMemberStart(e.target.value)} /></label></div>
          <button type="button" className={button} disabled={busy || !location || !vendor || !memberStart} onClick={() => void mutate({ action: "addMembership", locationId: location, vendorId: vendor, start: memberStart, confirmed: false, seenCount: null }, true)}>場所に登録</button>
          {legacyPlaces.length > 0 && <div className="rounded-lg bg-amber-50 p-3 text-sm"><p>旧データに未移行の場所があります。日付や場所を確認してから登録してください。旧データだけで予定は自動作成しません。</p><ul>{legacyPlaces.map(([id, date]) => { const place = locations.find((item) => item.id === id); return <li key={id}><button type="button" className="underline" onClick={() => selectLocation(id)}>{place ? placeLabel(place) : "場所不明"}</button>{date ? `（記録日 ${date}）` : "（旧形式の登録）"}</li>; })}</ul></div>}
          <ul className="space-y-2 text-sm">{locationMembers.map((item) => { const open = data.periods.find((period) => period.membership_id === item.id && period.ends_on === null); return <li key={item.id} className="flex flex-wrap items-center gap-3 border-t border-nicchyo-ink/10 pt-2"><button type="button" className="font-bold underline" onClick={() => setPreviewVendor(item.vendor_id)}>店舗{item.vendor_number}：{vendorName(item.vendor_id)}</button><span>{data.periods.filter((period) => period.membership_id === item.id).map((period) => `${period.starts_on}〜${period.ends_on ?? "継続中"}`).join("、") || "期間未設定"}</span><a className="text-nicchyo-primary underline" href={`/admin/field/${item.vendor_id}`}>店舗情報</a>{open && <span className="flex flex-wrap items-center gap-2"><label>終了日<input type="date" aria-label={`${vendorName(item.vendor_id)}の登録終了日`} className={control} value={endDates[`member:${item.id}`] ?? ""} onChange={(event) => setEndDates((current) => ({ ...current, [`member:${item.id}`]: event.target.value }))} /></label><button type="button" className="underline" disabled={busy || !endDates[`member:${item.id}`]} onClick={() => { if (window.confirm("この日で場所への登録を終了しますか？ 過去の履歴と店舗番号は残ります。")) void mutate({ action: "endMembership", membershipId: item.id, end: endDates[`member:${item.id}`], expectedStart: open.starts_on }); }}>出店終了</button></span>}</li>; })}</ul>
          {previewVendor && <ShopPreview vendorId={previewVendor} position={locations.find((item) => item.id === location)?.store_number ?? 1} onClose={() => setPreviewVendor(null)} />}
        </section>
        <section id="recurrence" className={section}>
          <p className="text-xs font-bold tracking-wider text-amber-800">STEP 04</p><h2 className="text-xl font-bold">繰り返し予定</h2><label className="block text-sm font-bold">繰り返しの開始日（日曜日）<input type="date" className={`${control} mt-1`} value={ruleStart} onChange={(e) => setRuleStart(e.target.value)} /></label><p className="text-sm">開始日は日曜日を指定します。予定が重なる日は競合として表示し、自動では店舗を選びません。</p>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-bold">店舗<select className={`${control} mt-1`} value={membership} onChange={(e) => setMembership(e.target.value)}><option value="">店舗を選択</option>{locationMembers.map((item) => <option key={item.id} value={item.id}>店舗{item.vendor_number}：{vendorName(item.vendor_id)}</option>)}</select></label>
          <label className="block text-sm font-bold">繰り返し<select className={`${control} mt-1`} value={cadence} onChange={(e) => setCadence(e.target.value as typeof cadence)}><option value="weekly">毎週</option><option value="fortnightly">開始日から隔週</option><option value="monthly">第○日曜日</option></select></label></div>
          {cadence === "monthly" && <fieldset className="flex flex-wrap gap-3"><legend className="text-sm font-bold">出店する週</legend>{[1,2,3,4,5].map((week) => <label key={week}><input type="checkbox" checked={weeks.includes(week)} onChange={(e) => setWeeks((current) => e.target.checked ? [...current, week].sort() : current.filter((item) => item !== week))} /> 第{week}</label>)}</fieldset>}
          {ruleStart && new Date(`${ruleStart}T00:00:00Z`).getUTCDay() !== 0 && <p role="status" className="text-sm text-amber-800">繰り返しの開始日には日曜日を選んでください。</p>}
          <button type="button" className={button} disabled={busy || !locationMembers.some((item) => item.id === membership) || !ruleStart || new Date(`${ruleStart}T00:00:00Z`).getUTCDay() !== 0 || (cadence === "monthly" && !weeks.length)} onClick={() => void mutate({ action: "addRule", membershipId: membership, cadence, start: ruleStart, end: null, anchor: cadence === "fortnightly" ? ruleStart : null, weeks: cadence === "monthly" ? weeks : null })}>繰り返しを追加</button>
          <ul className="space-y-2 text-sm">{data.rules.filter((rule) => locationMembers.some((item) => item.id === rule.membership_id)).map((rule) => { const item = locationMembers.find((entry) => entry.id === rule.membership_id); return <li key={rule.id} className="border-t border-nicchyo-ink/10 pt-2">{item ? vendorName(item.vendor_id) : "店舗不明"}：{rule.cadence === "weekly" ? "毎週" : rule.cadence === "fortnightly" ? "隔週" : `第${rule.month_weeks?.join("・")}日曜`}（{rule.starts_on}〜{rule.ends_on ?? "終了日なし"}）{rule.voided_at ? "（取消済み）" : ""} {!rule.voided_at && rule.ends_on === null && <span className="inline-flex flex-wrap items-center gap-2"><label>最後の出店日<input type="date" aria-label={`${item ? vendorName(item.vendor_id) : "店舗"}の繰り返し終了日`} className={control} value={endDates[`rule:${rule.id}`] ?? ""} onChange={(event) => setEndDates((current) => ({ ...current, [`rule:${rule.id}`]: event.target.value }))} /></label><button type="button" className="underline" disabled={busy || !endDates[`rule:${rule.id}`]} onClick={() => void mutate({ action: "endRule", ruleId: rule.id, end: endDates[`rule:${rule.id}`], expectedEnd: null })}>終了日を設定</button></span>} {!rule.voided_at && <button type="button" className="ml-2 underline" disabled={busy} onClick={() => { if (window.confirm("この繰り返しを誤登録として取り消します。過去も含め予定から除外されます。続けますか？")) void mutate({ action: "voidRule", ruleId: rule.id, expectedEnd: rule.ends_on }); }}>誤登録を取り消す</button>}</li>; })}</ul>
        </section>

        {vendor && <section className={section}>
          <h2 className="text-lg font-bold">{vendorName(vendor)}の出店先</h2>
          <p className="text-sm">店舗を基準に、同じ日付の全場所を確認できます。場所名を押すと、その場所の予定を編集できます。</p>
          {vendorPlan.map((day) => <div key={day.date} className="flex flex-wrap gap-2 border-t border-nicchyo-ink/10 py-2 text-sm"><strong>{day.date}</strong>{day.places.length ? day.places.map((item) => {
            const place = locations.find((entry) => entry.id === item.locationId);
            return <button type="button" key={item.locationId} className="text-nicchyo-primary underline" onClick={() => selectLocation(item.locationId)}>{place ? placeLabel(place) : "場所不明"}{item.state === "conflict" ? "（競合）" : ""}</button>;
          }) : <span>{day.marketClosed ? "日曜市は中止・休み" : "予定なし・未設定"}</span>}</div>)}
        </section>}
      </>}
    </main></AdminLayout>;
}
