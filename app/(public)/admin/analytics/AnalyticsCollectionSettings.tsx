"use client";

import { useEffect, useState } from "react";
import { ANALYTICS_COLLECTION_ITEMS, type AnalyticsCollectionSettings } from "@/lib/analytics/collectionSettings";

export default function AnalyticsCollectionSettings() {
  const [settings, setSettings] = useState<AnalyticsCollectionSettings | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetch("/api/admin/analytics/collection", { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => setSettings(data.settings as AnalyticsCollectionSettings))
      .catch(() => setMessage("設定を読み込めませんでした。再読み込みしてください。"));
  }, []);
  async function save() {
    if (!settings) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/admin/analytics/collection", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      if (!response.ok) throw new Error();
      setSettings((await response.json()).settings as AnalyticsCollectionSettings);
      setMessage("保存しました。停止は今後の記録に適用されます。");
    } catch { setMessage("保存できませんでした。もう一度お試しください。"); }
    finally { setSaving(false); }
  }
  return <section className="rounded-card border border-line bg-white p-5">
    <h2 className="text-lg font-bold">計測の取得設定</h2>
    <p className="mt-2 text-sm">項目ごとに今後の取得を切り替えます。保存済みのデータは削除されません。利用者の解析停止設定も適用されます。</p>
    {settings && <><div className="mt-4 space-y-3">{ANALYTICS_COLLECTION_ITEMS.map(({ key, label }) => <label key={key} className="flex items-center gap-3"><input type="checkbox" disabled={key === "googleAnalytics"} checked={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })} /><span>{label}：{key === "googleAnalytics" ? "停止機能は準備中" : settings[key] ? "取得する" : "停止"}</span></label>)}</div><button type="button" disabled={saving} onClick={() => void save()} className="mt-4 rounded-lg bg-nicchyo-primary px-4 py-2 font-bold text-white disabled:opacity-50">{saving ? "保存中" : "設定を保存"}</button></>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </section>;
}
