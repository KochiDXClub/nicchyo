import { notFound } from "next/navigation";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import Link from "next/link";
import { AdminLayout } from "@/components/admin";

interface ReportRow {
  report_date: string;
  week_start: string;
  week_end: string;
  html_content: string;
  risk_level: string;
  anomaly_count: number;
}

async function getReport(date: string): Promise<ReportRow | null> {
  // YYYY-MM-DD形式のバリデーション
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const supabase = createServiceClient(url, key, { auth: { persistSession: false } });
  const { data } = await supabase
    .from("security_reports")
    .select("report_date, week_start, week_end, html_content, risk_level, anomaly_count")
    .eq("report_date", date)
    .single();

  return (data as ReportRow | null) ?? null;
}

export default async function ReportDetailPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const report = await getReport(date);

  if (!report) notFound();

  return (
    <AdminLayout withBottomPadding={false}>
      <main className="min-h-screen bg-nicchyo-base pb-16">
      {/* 戻るナビ */}
      <div className="sticky top-0 z-10 border-b border-nicchyo-ink/10 bg-nicchyo-base/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Link
            href="/admin/security-reports"
            className="rounded-full border border-nicchyo-ink/20 px-3 py-1 text-xs font-semibold text-nicchyo-ink/70 hover:bg-nicchyo-ink/5"
          >
            ← 一覧へ
          </Link>
          <span className="text-sm font-semibold text-nicchyo-ink">{report.report_date} レポート</span>
        </div>
      </div>

      {/* HTMLレポートを iframe でレンダリング（XSS隔離） */}
      <iframe
        srcDoc={report.html_content}
        className="w-full"
        style={{ height: "calc(100vh - 56px)", border: "none" }}
        sandbox="allow-same-origin"
        title={`セキュリティレポート ${report.report_date}`}
      />
      </main>
    </AdminLayout>
  );
}
