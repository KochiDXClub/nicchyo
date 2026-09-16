import Link from "next/link";
import { AdminLayout, AdminPageHeader, EmptyState } from "@/components/admin";
import { createClient as createServiceClient } from "@supabase/supabase-js";

interface ReportRow {
  report_date: string;
  week_start: string;
  week_end: string;
  risk_level: string;
  anomaly_count: number;
  total_visitors: number;
  total_page_visits: number;
  created_at: string;
}

function riskBadgeStyle(level: string): string {
  const map: Record<string, string> = {
    low: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    high: "bg-red-100 text-red-700",
    critical: "bg-purple-100 text-purple-700",
  };
  return map[level] ?? "bg-gray-100 text-gray-600";
}

async function getReports(): Promise<ReportRow[]> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const supabase = createServiceClient(url, key, { auth: { persistSession: false } });
  const { data } = await supabase
    .from("security_reports")
    .select("report_date, week_start, week_end, risk_level, anomaly_count, total_visitors, total_page_visits, created_at")
    .order("report_date", { ascending: false })
    .limit(52); // 最大1年分
  return (data ?? []) as ReportRow[];
}

export default async function ReportsPage() {
  const reports = await getReports();

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="Security Reports"
        title="週次レポート"
        description="毎週生成される利用状況・異常検知レポートの一覧です。"
      />
      <div className="mx-auto max-w-3xl px-4 pb-16">

        {reports.length === 0 ? (
          <EmptyState icon="📄" title="レポートはまだありません" description="週次レポートが生成されるとここに表示されます。" />
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.report_date}>
                <Link
                  href={`/admin/security-reports/${r.report_date}`}
                  className="flex items-center justify-between rounded-xl border border-nicchyo-ink/10 bg-white px-5 py-4 shadow-sm transition hover:shadow-md"
                >
                  <div>
                    <p className="font-bold text-nicchyo-ink">{r.report_date}</p>
                    <p className="mt-0.5 text-xs text-nicchyo-ink/50">
                      {r.week_start} ～ {r.week_end}
                    </p>
                    <p className="mt-1 text-xs text-nicchyo-ink/40">
                      訪問者 {r.total_visitors.toLocaleString()}人 ・ PV {r.total_page_visits.toLocaleString()}件 ・ 異常 {r.anomaly_count}件
                    </p>
                  </div>
                  <span
                    className={`ml-4 shrink-0 rounded-full px-3 py-1 text-xs font-bold ${riskBadgeStyle(r.risk_level)}`}
                  >
                    {r.risk_level.toUpperCase()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminLayout>
  );
}
