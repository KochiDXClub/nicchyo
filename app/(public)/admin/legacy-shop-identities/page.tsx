"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout, AdminPageHeader } from "@/components/admin";
import { useAuth } from "@/lib/auth/AuthContext";

type Candidate = { legacy_shop_id: number; vendor_ids: string[]; candidate_count: number };
type Alias = { legacy_shop_id: number; vendor_id: string | null; confirmed_at: string; evidence: string };
type Vendor = { id: string; shop_name: string | null; public_shop_id: number };
type Revocation = { legacy_shop_id: number; reason: string; revoked_at: string };
type Data = { candidates: Candidate[]; aliases: Alias[]; revocations: Revocation[]; vendors: Vendor[] };
const input = "w-full rounded-lg border border-line bg-white px-3 py-2 text-base text-nicchyo-ink";

export default function LegacyShopIdentitiesPage() {
  const { permissions, isLoading } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [legacy, setLegacy] = useState("");
  const [vendor, setVendor] = useState("");
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [rollout, setRollout] = useState<{ enabled: boolean; revision: number; summary: { date: string; scheduled: number; conflicts: number; unplanned: number; closed: boolean } } | null>(null);
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/legacy-shop-identities", { cache: "no-store" });
    if (!response.ok) throw new Error("旧番号の確認情報を取得できませんでした");
    setData(await response.json() as Data);
    const settings = await fetch("/api/admin/public-schedule", { cache: "no-store" });
    if (!settings.ok) throw new Error("公開設定を取得できませんでした");
    setRollout(await settings.json() as NonNullable<typeof rollout>);
  }, []);
  useEffect(() => { if (permissions.isAdmin) void load().catch(() => setError("旧番号の確認情報を取得できませんでした")); }, [permissions.isAdmin, load]);
  const number = /^\d{1,3}$/.test(legacy) ? Number(legacy) : 0;
  const candidate = data?.candidates.find((entry) => entry.legacy_shop_id === number);
  const alias = data?.aliases.find((entry) => entry.legacy_shop_id === number);
  const revocation = data?.revocations.find((entry) => entry.legacy_shop_id === number);
  const aliasHistoryConflict = Boolean(alias && candidate && (candidate.candidate_count > 1 || (alias.vendor_id && !candidate.vendor_ids.includes(alias.vendor_id))));
  const name = useCallback((id: string) => data?.vendors.find((item) => item.id === id)?.shop_name || "名称未設定", [data]);
  const vendors = useMemo(() => [...(data?.vendors ?? [])].sort((a, b) => (a.shop_name ?? "").localeCompare(b.shop_name ?? "", "ja")), [data]);

  async function confirm() {
    if (!number || !vendor || evidence.trim().length < 10 || alias || (candidate?.candidate_count ?? 0) > 1 || (candidate && !candidate.vendor_ids.includes(vendor))) return;
    const code = String(number).padStart(3, "0");
    if (!window.confirm(`旧番号 ${code} を「${name(vendor)}」に確定します。確定後は別の店舗に変更できません。根拠を確認しましたか？`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/legacy-shop-identities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ legacyId: number, vendorId: vendor, evidence, confirmed: true }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "確定できませんでした");
      await load(); setNotice(`旧番号 ${code} を確定しました。`); setVendor(""); setEvidence("");
    } catch (e) { setError(e instanceof Error ? e.message : "確定できませんでした"); }
    finally { setBusy(false); }
  }

  async function revoke() {
    if (!alias || revocation || evidence.trim().length < 10) return;
    if (!window.confirm(`旧番号 ${String(number).padStart(3, "0")} の対応を取り消します。別の店舗には付け直せません。よろしいですか？`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/legacy-shop-identities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revoke", legacyId: number, evidence, confirmed: true }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "取り消せませんでした");
      await load(); setEvidence(""); setNotice("旧番号の対応を取り消しました。");
    } catch (e) { setError(e instanceof Error ? e.message : "取り消せませんでした"); }
    finally { setBusy(false); }
  }

  async function toggleRollout() {
    if (!rollout) return;
    if (rollout.enabled) return;
    const enabled = true;
    const message = "出店予定と店舗固有 ID を公開します。公開後は旧番号の表示に戻せません。未確認の旧番号は自動で結び付きません。予定・旧番号の確認は完了していますか？";
    if (!window.confirm(message)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/public-schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, revision: rollout.revision, confirmed: true }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "公開設定を保存できませんでした");
      await load(); setNotice("出店予定の公開を開始しました。");
    } catch (e) { setError(e instanceof Error ? e.message : "公開設定を保存できませんでした"); }
    finally { setBusy(false); }
  }

  if (isLoading || !permissions.isAdmin) return null;
  return <AdminLayout><AdminPageHeader eyebrow="Migration" title="旧店舗番号の確認" description="以前の店舗 URL と、店舗の対応を確認します" />
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-5">
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">旧番号は場所を示していたため、履歴だけでは元のお気に入りの店舗を特定できない場合があります。確実な根拠がない番号は未確定のままにしてください。確定した対応は変更できません。</p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm">{notice}</p>}
      {!data ? <p>読み込み中…</p> : <>
        <section className="space-y-3 rounded-lg border border-line bg-white p-4">
          <h2 className="text-lg font-bold">出店予定の公開</h2>
          <p className="text-sm">現在：<strong>{rollout?.enabled ? "公開中" : "準備中"}</strong></p>
          {rollout && <p className="text-sm">次の日曜日 {rollout.summary.date}：{rollout.summary.closed ? "日曜市は中止・休み" : `出店予定 ${rollout.summary.scheduled} 場所・移行済みで未設定 ${rollout.summary.unplanned} 場所`}</p>}
          {rollout && rollout.summary.conflicts > 0 && <p role="alert" className="text-sm font-bold text-amber-800">今後６週間に予定の競合が {rollout.summary.conflicts} 件あります。出店予定管理で解消してから公開してください。</p>}
          <p className="text-sm text-nicchyo-ink/70">公開後は次の日曜日の配置だけを地図に表示します。未設定・競合中の場所や、別の日の旧配置は表示しません。店舗情報は検索やお気に入りから確認できます。</p>
          {rollout?.enabled ? <p className="text-sm text-nicchyo-ink/70">店舗 ID を保護するため、旧番号の表示には戻せません。公開停止が必要な場合はマップの公開設定を変更してください。</p> : <button type="button" className="min-h-11 rounded-lg border border-line px-4 py-2 text-sm font-bold" disabled={busy || !rollout || rollout.summary.conflicts > 0} onClick={() => void toggleRollout()}>出店予定を公開</button>}
        </section>
        <section className="space-y-4 rounded-lg border border-line bg-white p-4">
          <h2 className="text-lg font-bold">旧番号を確認する</h2>
          <label className="block text-sm font-bold">旧番号（001〜999）<input className={`${input} mt-1`} inputMode="numeric" value={legacy} onChange={(e) => { setLegacy(e.target.value.replace(/\D/g, "").slice(0, 3)); setVendor(""); setEvidence(""); }} /></label>
          {number > 0 && (alias ? <div className="space-y-2 rounded-lg bg-nicchyo-base p-3 text-sm"><strong>{revocation ? "取消済み" : "確定済み"}</strong>{!revocation && aliasHistoryConflict && <p role="alert" className="font-bold text-amber-800">配置履歴が確定内容と一致しないため、公開側ではこの対応を使用しません。</p>}<p>{alias.vendor_id ? name(alias.vendor_id) : "店舗は削除されています"}</p><p>確認根拠：{alias.evidence}</p>{revocation ? <p>取消理由：{revocation.reason}</p> : <><label className="block font-bold">取消理由（10文字以上）<textarea className={`${input} mt-1`} rows={2} maxLength={1000} value={evidence} onChange={(e) => setEvidence(e.target.value)} /></label><button type="button" className="min-h-11 underline disabled:opacity-50" disabled={busy || evidence.trim().length < 10} onClick={() => void revoke()}>この対応を取り消す</button><p>取り消した番号を別の店舗には付け直せません。</p></>}</div> : <>
            <div className="rounded-lg bg-nicchyo-base p-3 text-sm"><strong>配置履歴の候補</strong>{candidate?.vendor_ids.length ? <ul className="mt-1 list-inside list-disc">{candidate.vendor_ids.map((id) => <li key={id}>{name(id)}</li>)}</ul> : <p>履歴から候補は見つかりませんでした。</p>}<p className="mt-2 text-nicchyo-ink/70">候補が１店舗でも、古い履歴が残っていない可能性があります。</p></div>
            {(candidate?.candidate_count ?? 0) > 1 && <p role="alert" className="text-sm font-bold text-amber-800">複数の店舗に使われた番号は、過去のお気に入りの店舗を一つに決められないため確定できません。</p>}
            <label className="block text-sm font-bold">対応する店舗<select className={`${input} mt-1`} value={vendor} onChange={(e) => setVendor(e.target.value)}><option value="">店舗を選択</option>{vendors.map((item) => <option key={item.id} value={item.id}>{item.shop_name || "名称未設定"}（店舗 ID {item.public_shop_id}）</option>)}</select></label>
            <label className="block text-sm font-bold">確認した根拠（10文字以上）<textarea className={`${input} mt-1`} rows={3} maxLength={1000} value={evidence} onChange={(e) => setEvidence(e.target.value)} /></label>
            <button type="button" className="min-h-11 rounded-lg bg-amber-800 px-4 py-2 font-bold text-white disabled:opacity-50" disabled={busy || !vendor || evidence.trim().length < 10 || (candidate?.candidate_count ?? 0) > 1 || Boolean(candidate && vendor && !candidate.vendor_ids.includes(vendor))} onClick={() => void confirm()}>この対応を確定</button>
          </>)}
        </section>
        <section className="rounded-lg border border-line bg-white p-4"><h2 className="text-lg font-bold">履歴に候補がある番号</h2><p className="mt-1 text-sm text-nicchyo-ink/70">番号を押すと内容を確認できます。未確定の番号は自動で変更されません。</p><div className="mt-3 flex flex-wrap gap-2">{data.candidates.map((item) => <button type="button" key={item.legacy_shop_id} className="min-h-11 rounded-lg border border-line px-3 text-sm" onClick={() => { setLegacy(String(item.legacy_shop_id)); setVendor(""); setEvidence(""); }}>{String(item.legacy_shop_id).padStart(3, "0")} {data.revocations.some((entry) => entry.legacy_shop_id === item.legacy_shop_id) ? "取消済" : item.candidate_count > 1 ? "複数候補" : data.aliases.some((entry) => entry.legacy_shop_id === item.legacy_shop_id) ? "確定済" : "未確認"}</button>)}</div></section>
      </>}
    </main></AdminLayout>;
}
