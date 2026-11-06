"use client";
import { useEffect, useState } from "react";
import type { ScheduleAdminData } from "@/lib/market-schedule/adminTypes";
import { formatMarketAddress } from "@/lib/market-schedule/address";
import { Card } from "./fieldFormParts";

/** 店舗ごとの出店先。場所の位置と予定の編集は、それぞれの管理画面へ移動する。 */
export function FieldMarketPlaceCard({ shopId }: { shopId: string }) {
  const [data, setData] = useState<ScheduleAdminData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetch("/api/admin/market-schedule", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("出店場所を取得できませんでした");
      const result = await response.json() as ScheduleAdminData;
      if (active) setData(result);
    }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "取得できませんでした"); });
    return () => { active = false; };
  }, [shopId]);
  const memberships = data?.memberships.filter((item) => item.vendor_id === shopId) ?? [];
  const oldPlaceId = data?.vendors.find((item) => item.id === shopId)?.market_place_id;
  const oldPlace = oldPlaceId && !memberships.some((item) => item.location_id === oldPlaceId) ? data?.places.find((item) => item.id === oldPlaceId) : null;
  const legacyLocations = [...new Set((data?.legacyAssignments ?? []).filter((item) => item.vendor_id === shopId && item.location_id !== oldPlaceId && !memberships.some((member) => member.location_id === item.location_id)).map((item) => item.location_id))];
  return <Card title="出店場所・予定">
    <p className="text-sm text-nicchyo-ink/70">同じ店舗の複数の出店先と、各場所での登録期間を確認できます。出店日・繰り返し・休みは出店予定管理で編集します。</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {oldPlace && <p className="text-sm text-amber-800">旧形式の登録「{oldPlace.place_name || `区画 ${oldPlace.store_number}`}」はまだ予定管理に移行されていません。開始日を確認して登録してください。</p>}
    {legacyLocations.length > 0 && <p className="text-sm text-amber-800">旧データに未移行の配置が {legacyLocations.length} 件あります。出店予定管理で場所と日付を確認してください。</p>}
    {data && (memberships.length ? <ul className="space-y-2 text-sm">{memberships.map((member) => {
      const place = data.places.find((item) => item.id === member.location_id);
      const address = place?.official_number != null ? formatMarketAddress({ main: place.official_number, branch: place.branch_number }) : null;
      const periods = data.periods.filter((item) => item.membership_id === member.id).sort((a,b) => b.starts_on.localeCompare(a.starts_on));
      return <li key={member.id} className="rounded-lg border border-nicchyo-ink/10 p-3"><strong>{place?.place_name || (address ? `住所 ${address}` : `住所未設定（区画 ${place?.store_number ?? "不明"}）`)} ／ 店舗{member.vendor_number}</strong>{address && place?.place_name && <span>（住所 {address}）</span>}<ul>{periods.map((period) => <li key={period.id}>{period.starts_on}〜{period.ends_on ?? "継続中"}</li>)}</ul></li>;
    })}</ul> : <p className="text-sm">出店場所はまだ登録されていません。</p>)}
    <a className="text-sm font-bold text-nicchyo-primary underline" href={`/admin/market-schedule?vendor=${encodeURIComponent(shopId)}`}>この店舗の出店予定を管理</a>
  </Card>;
}
