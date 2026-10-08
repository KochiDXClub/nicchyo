"use client";

import { useState } from "react";

type ExportType = "page_analytics" | "shop_views" | "search_logs" | "consult_logs";

const EXPORT_OPTIONS: { value: ExportType; label: string }[] = [
  { value: "page_analytics", label: "ページアクセス" },
  { value: "shop_views", label: "店舗閲覧" },
  { value: "search_logs", label: "検索ログ" },
  { value: "consult_logs", label: "AI相談ログ" },
];

const DAYS_OPTIONS = [
  { value: 7, label: "7日" },
  { value: 30, label: "30日" },
  { value: 90, label: "90日" },
  { value: 365, label: "1年" },
];

export default function AnalyticsExportButton() {
  const [exportType, setExportType] = useState<ExportType>("page_analytics");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const url = `/api/admin/analytics/export?type=${exportType}&days=${days}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("エクスポート失敗");
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `analytics_export.csv`;

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      alert("エクスポートに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={exportType}
        onChange={(e) => setExportType(e.target.value as ExportType)}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
      >
        {EXPORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <select
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
      >
        {DAYS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>直近{o.label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={loading}
        className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40"
      >
        {loading ? "出力中..." : "CSV ダウンロード"}
      </button>
    </div>
  );
}
