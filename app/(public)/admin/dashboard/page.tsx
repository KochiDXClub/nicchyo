import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { AdminLayout, AdminPageHeader, StatCard } from "@/components/admin";
import TrafficChartCard, { type TrafficGranularity, type TrafficPoint } from "@/components/admin/TrafficChartCard";
import { createClient } from "@/utils/supabase/server";
import { getRole, isAdmin } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

type ActivityItem = {
  id: string;
  icon: string;
  text: string;
  timestamp: string | null;
};

type DurationPoint = {
  date: string;
  averageMinutes: number;
  vendorAverageMinutes: number;
};

type PageAnalyticsRow = {
  visit_date: string;
  visitor_key: string;
  path: string;
  duration_seconds: number | null;
  user_role: string | null;
};

type DailyUniqueRow = {
  visit_date: string;
  visitor_key: string;
};

type UrlSummary = {
  path: string;
  visitors: number;
  averageMinutes: number;
  totalMinutes: number;
};

type VendorActivityRow = {
  id: string;
  shop_name: string | null;
  created_at: string | null;
};

type ContentActivityRow = {
  id: string;
  title: string | null;
  created_at: string | null;
};

type LandmarkActivityRow = {
  key: string;
  name: string | null;
  created_at: string | null;
};

function getDisplayName(user: unknown) {
  if (!user || typeof user !== "object") return "管理者";
  const record = user as {
    user_metadata?: { name?: string };
    email?: string;
  };
  return record.user_metadata?.name ?? record.email ?? "管理者";
}

function formatDateTime(value: string | null) {
  if (!value) return "日時不明";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時不明";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function formatMonthLabel(value: string) {
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
  }).format(date) + "月";
}

function formatYearLabel(year: number) {
  return `${year}年`;
}

function formatMinutes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0.0分";
  return `${value.toFixed(1)}分`;
}

function buildVisitorDailyDurationMap(rows: PageAnalyticsRow[]) {
  const byDate = new Map<string, Map<string, number>>();

  for (const row of rows) {
    if (!row.visit_date || !row.visitor_key) continue;
    if (isAdmin(row.user_role)) continue;
    const duration = typeof row.duration_seconds === "number" ? row.duration_seconds : 0;
    const visitorMap = byDate.get(row.visit_date) ?? new Map<string, number>();
    visitorMap.set(row.visitor_key, (visitorMap.get(row.visitor_key) ?? 0) + duration);
    byDate.set(row.visit_date, visitorMap);
  }

  return byDate;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toMonthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function getStartOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setUTCDate(result.getUTCDate() + diff);
  return result;
}

function formatWeekLabel(startIso: string) {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return `${new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(start)}-${new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(end)}`;
}

function buildTrafficSeries(
  rows: DailyUniqueRow[],
  now: Date
) {
  const normalizedRows = rows.filter((row) => row.visit_date && row.visitor_key);
  const periodVisitors = {
    day: new Map<string, Set<string>>(),
    week: new Map<string, Set<string>>(),
    month: new Map<string, Set<string>>(),
    year: new Map<string, Set<string>>(),
  } satisfies Record<TrafficGranularity, Map<string, Set<string>>>;

  for (const row of normalizedRows) {
    const date = new Date(`${row.visit_date}T00:00:00Z`);
    const dayKey = row.visit_date;
    const weekKey = toIsoDate(getStartOfWeek(date));
    const monthKey = toMonthKey(date);
    const yearKey = String(date.getUTCFullYear());
    const keys: Record<TrafficGranularity, string> = {
      day: dayKey,
      week: weekKey,
      month: monthKey,
      year: yearKey,
    };

    (Object.keys(keys) as TrafficGranularity[]).forEach((granularity) => {
      const totalSet = periodVisitors[granularity].get(keys[granularity]) ?? new Set<string>();
      totalSet.add(row.visitor_key);
      periodVisitors[granularity].set(keys[granularity], totalSet);
    });
  }

  const daySeries: TrafficPoint[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    date.setUTCDate(date.getUTCDate() - (6 - index));
    const key = toIsoDate(date);
    return {
      key,
      label: formatShortDate(key),
      value: periodVisitors.day.get(key)?.size ?? 0,
    };
  });

  const weekSeries: TrafficPoint[] = Array.from({ length: 8 }, (_, index) => {
    const currentWeekStart = getStartOfWeek(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
    currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - (7 * (7 - index)));
    const key = toIsoDate(currentWeekStart);
    return {
      key,
      label: formatWeekLabel(key),
      value: periodVisitors.week.get(key)?.size ?? 0,
    };
  });

  const monthSeries: TrafficPoint[] = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 1));
    const key = toMonthKey(date);
    return {
      key,
      label: formatMonthLabel(key),
      value: periodVisitors.month.get(key)?.size ?? 0,
    };
  });

  const yearSeries: TrafficPoint[] = Array.from({ length: 5 }, (_, index) => {
    const year = now.getUTCFullYear() - (4 - index);
    const key = String(year);
    return {
      key,
      label: formatYearLabel(year),
      value: periodVisitors.year.get(key)?.size ?? 0,
    };
  });

  return {
    day: daySeries,
    week: weekSeries,
    month: monthSeries,
    year: yearSeries,
  } satisfies Record<TrafficGranularity, TrafficPoint[]>;
}

function createAdminReadClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = getRole(user);

  if (!user || !role) {
    redirect("/login");
  }

  if (!isAdmin(role)) {
    redirect("/");
  }

  const adminReadClient = createAdminReadClient();
  const dataClient = adminReadClient ?? supabase;

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  const weeklyStart = new Date(now);
  weeklyStart.setDate(now.getDate() - 6);
  const weeklyStartIso = weeklyStart.toISOString().slice(0, 10);
  const yearlyAnalyticsStart = new Date(Date.UTC(now.getFullYear() - 4, 0, 1))
    .toISOString()
    .slice(0, 10);

  const [
    vendorsCountResult,
    activeContentsCountResult,
    periodPageAnalyticsResult,
    pageAnalyticsResult,
    latestPageVisitDateResult,
    latestVendorsResult,
    latestContentsResult,
    latestLandmarksResult,
  ] = await Promise.all([
    dataClient.from("vendors").select("*", { count: "exact", head: true }),
    dataClient
      .from("vendor_contents")
      .select("*", { count: "exact", head: true })
      .gt("expires_at", now.toISOString()),
    dataClient
      .from("web_page_analytics")
      .select("visit_date, visitor_key, path, duration_seconds, user_role")
      .gte("visit_date", yearlyAnalyticsStart)
      .lte("visit_date", todayIso),
    dataClient
      .from("web_page_analytics")
      .select("visit_date, visitor_key, path, duration_seconds, user_role")
      .eq("visit_date", todayIso)
      .order("created_at", { ascending: false }),
    dataClient
      .from("web_page_analytics")
      .select("visit_date")
      .order("visit_date", { ascending: false })
      .limit(1),
    dataClient
      .from("vendors")
      .select("id, shop_name, created_at")
      .order("created_at", { ascending: false })
      .limit(3),
    dataClient
      .from("vendor_contents")
      .select("id, title, created_at")
      .order("created_at", { ascending: false })
      .limit(3),
    dataClient
      .from("map_landmarks")
      .select("key, name, created_at")
      .order("created_at", { ascending: false })
      .limit(2),
  ]);

  const pageAnalytics = Array.isArray(pageAnalyticsResult.data)
    ? (pageAnalyticsResult.data as PageAnalyticsRow[])
    : [];
  const periodPageAnalytics = Array.isArray(periodPageAnalyticsResult.data)
    ? (periodPageAnalyticsResult.data as PageAnalyticsRow[])
    : [];
  const latestAnalyticsDate =
    Array.isArray(latestPageVisitDateResult.data) &&
    latestPageVisitDateResult.data[0] &&
    typeof latestPageVisitDateResult.data[0].visit_date === "string"
      ? latestPageVisitDateResult.data[0].visit_date
      : null;
  let latestDayPageAnalytics = pageAnalytics;
  if (latestDayPageAnalytics.length === 0 && latestAnalyticsDate && latestAnalyticsDate !== todayIso) {
    const latestDayAnalyticsResult = await dataClient
      .from("web_page_analytics")
      .select("visit_date, visitor_key, path, duration_seconds, user_role")
      .eq("visit_date", latestAnalyticsDate)
      .order("created_at", { ascending: false });
    latestDayPageAnalytics = Array.isArray(latestDayAnalyticsResult.data)
      ? (latestDayAnalyticsResult.data as PageAnalyticsRow[])
      : [];
  }

  const allTrafficRows: DailyUniqueRow[] = Array.from(
    new Map(
      periodPageAnalytics
        .filter((row) => !isAdmin(row.user_role))
        .map((row) => [`${row.visit_date}:${row.visitor_key}`, { visit_date: row.visit_date, visitor_key: row.visitor_key }])
    ).values()
  );
  const vendorTrafficRows: DailyUniqueRow[] = Array.from(
    new Map(
      periodPageAnalytics
        .filter((row) => row.user_role === "vendor")
        .map((row) => [`${row.visit_date}:${row.visitor_key}`, { visit_date: row.visit_date, visitor_key: row.visitor_key }])
    ).values()
  );
  const trafficSeriesByGranularity = buildTrafficSeries(
    allTrafficRows,
    new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  );
  const vendorTrafficSeriesByGranularity = buildTrafficSeries(
    vendorTrafficRows,
    new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  );
  const monthVisitors = new Set(
    allTrafficRows
      .filter((row) => row.visit_date >= monthStart && row.visit_date < monthEnd)
      .map((row) => row.visitor_key)
  ).size;
  const vendorVisitorsToday = new Set(
    vendorTrafficRows.filter((row) => row.visit_date === todayIso).map((row) => row.visitor_key)
  ).size;

  const weeklyDurationRows = periodPageAnalytics.filter(
    (row) => row.visit_date >= weeklyStartIso && row.visit_date <= todayIso
  );
  const visitorDailyDurationMap = buildVisitorDailyDurationMap(
    weeklyDurationRows
  );
  const vendorVisitorDailyDurationMap = buildVisitorDailyDurationMap(
    weeklyDurationRows.filter((row) => row.user_role === "vendor")
  );

  const durationSeries: DurationPoint[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weeklyStart);
    date.setDate(weeklyStart.getDate() + index);
    const iso = date.toISOString().slice(0, 10);
    const visitorDurations = Array.from((visitorDailyDurationMap.get(iso) ?? new Map()).values());
    const totalDuration = visitorDurations.reduce((sum, value) => sum + value, 0);
    const vendorDurations = Array.from((vendorVisitorDailyDurationMap.get(iso) ?? new Map()).values());
    const vendorTotalDuration = vendorDurations.reduce((sum, value) => sum + value, 0);
    return {
      date: iso,
      averageMinutes:
        visitorDurations.length > 0 ? totalDuration / visitorDurations.length / 60 : 0,
      vendorAverageMinutes:
        vendorDurations.length > 0 ? vendorTotalDuration / vendorDurations.length / 60 : 0,
    };
  });

  const durationMax = Math.max(
    ...durationSeries.flatMap((item) => [item.averageMinutes, item.vendorAverageMinutes]),
    1
  );
  const allVisitorTotals = Array.from(visitorDailyDurationMap.values()).flatMap((visitorMap) =>
    Array.from(visitorMap.values())
  );
  const weeklyDurationTotal = allVisitorTotals.reduce((sum, value) => sum + value, 0);
  const webAverageStayMinutes =
    allVisitorTotals.length > 0 ? weeklyDurationTotal / allVisitorTotals.length / 60 : 0;

  const nonAdminPageAnalytics = latestDayPageAnalytics.filter((row) => !isAdmin(row.user_role));
  const todayUrlMap = new Map<string, Map<string, number>>();
  for (const row of nonAdminPageAnalytics) {
    const path = row.path || "/";
    const visitors = todayUrlMap.get(path) ?? new Map<string, number>();
    visitors.set(
      row.visitor_key,
      (visitors.get(row.visitor_key) ?? 0) +
        (typeof row.duration_seconds === "number" ? row.duration_seconds : 0)
    );
    todayUrlMap.set(path, visitors);
  }

  const urlSummaries: UrlSummary[] = Array.from(todayUrlMap.entries())
    .map(([path, visitors]) => {
      const visitorDurations = Array.from(visitors.values());
      const totalSeconds = visitorDurations.reduce((sum, value) => sum + value, 0);
      return {
      path,
      visitors: visitors.size,
      averageMinutes: visitors.size > 0 ? totalSeconds / visitors.size / 60 : 0,
      totalMinutes: totalSeconds / 60,
    };
    })
    .sort((a, b) => {
      if (b.visitors !== a.visitors) return b.visitors - a.visitors;
      return b.totalMinutes - a.totalMinutes;
    })
    .slice(0, 12);

  const stats = [
    { title: "登録店舗数", value: vendorsCountResult.count ?? 0, icon: "🏪", bgColor: "bg-white border border-slate-200", textColor: "text-slate-800" },
    { title: "今月の訪問者", value: monthVisitors, icon: "📊", bgColor: "bg-white border border-slate-200", textColor: "text-slate-800" },
    { title: "出店者アクセス数", value: vendorVisitorsToday, icon: "🧑‍🌾", bgColor: "bg-white border border-slate-200", textColor: "text-slate-800" },
    { title: "公開中のお知らせ", value: activeContentsCountResult.count ?? 0, icon: "📝", bgColor: "bg-white border border-slate-200", textColor: "text-slate-800" },
  ];

  const latestVendorRows = Array.isArray(latestVendorsResult.data)
    ? (latestVendorsResult.data as VendorActivityRow[])
    : [];
  const latestContentRows = Array.isArray(latestContentsResult.data)
    ? (latestContentsResult.data as ContentActivityRow[])
    : [];
  const latestLandmarkRows = Array.isArray(latestLandmarksResult.data)
    ? (latestLandmarksResult.data as LandmarkActivityRow[])
    : [];

  const recentActivities: ActivityItem[] = [
    ...(latestVendorRows.map((row) => ({
      id: `vendor-${row.id}`,
      icon: "🏪",
      text: `店舗「${row.shop_name ?? "名称未設定"}」が登録されました`,
      timestamp: row.created_at as string | null,
    })) as ActivityItem[]),
    ...(latestContentRows.map((row) => ({
      id: `content-${row.id}`,
      icon: "📝",
      text: `投稿「${row.title ?? "タイトル未設定"}」が作成されました`,
      timestamp: row.created_at as string | null,
    })) as ActivityItem[]),
    ...(latestLandmarkRows.map((row) => ({
      id: `landmark-${row.key ?? row.name ?? row.created_at ?? Math.random().toString(36).slice(2)}`,
      icon: "🏛️",
      text: `建物オブジェクト「${row.name ?? row.key ?? "名称未設定"}」が追加されました`,
      timestamp: row.created_at as string | null,
    })) as ActivityItem[]),
  ]
    .sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 6);

  return (
    <AdminLayout>
      <AdminPageHeader eyebrow="Admin Dashboard" title="管理者ダッシュボード" />

      <div className="mx-auto max-w-7xl px-4 py-8 pb-20">
        <p className="mb-6 pl-14 text-sm text-slate-600">ようこそ、{getDisplayName(user)}さん</p>
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard
              key={stat.title}
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              bgColor={stat.bgColor}
              textColor={stat.textColor}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <TrafficChartCard
            eyebrow="Traffic"
            title="サイト全体の訪問者推移"
            legendLabel="全体"
            dotClassName="bg-indigo-600"
            panelClassName="bg-slate-50"
            barClassName="bg-indigo-600"
            seriesByGranularity={trafficSeriesByGranularity}
          />

          <TrafficChartCard
            eyebrow="Vendor Traffic"
            title="出店者ロールの訪問者推移"
            legendLabel="出店者のみ"
            dotClassName="bg-emerald-600"
            panelClassName="bg-slate-50"
            barClassName="bg-emerald-600"
            seriesByGranularity={vendorTrafficSeriesByGranularity}
          />

          <section className="rounded-2xl bg-white p-6 shadow" aria-labelledby="duration-chart">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Stay Time
                </p>
                <h2 id="duration-chart" className="mt-2 text-xl font-bold text-gray-900">
                  日別の平均滞在時間
                </h2>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">平均 {formatMinutes(webAverageStayMinutes)}</p>
                <div className="mt-2 flex items-center justify-end gap-4 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                    全体
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                    出店者のみ
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              {/* Y軸 */}
              <div
                className="flex w-12 shrink-0 flex-col-reverse justify-between pb-6 text-right"
                style={{ height: 180 + 24 }}
              >
                {Array.from(new Set([0, Math.ceil(durationMax / 2), Math.ceil(durationMax)])).map((tick) => (
                  <span key={tick} className="text-[10px] leading-none text-slate-400">
                    {tick > 0 ? `${tick}分` : "0"}
                  </span>
                ))}
              </div>

              {/* グラフ本体 */}
              <div className="min-w-0 flex-1">
                <div
                  className="flex items-end gap-2 border-b border-slate-200"
                  style={{ height: 180 }}
                >
                  {durationSeries.map((item) => (
                    <div key={item.date} className="flex h-full flex-1 items-end gap-0.5">
                      <div className="flex h-full flex-1 flex-col justify-end">
                        <div
                          className="w-full rounded-t bg-indigo-600"
                          style={{
                            height: `${Math.max((item.averageMinutes / durationMax) * 100, item.averageMinutes > 0 ? 5 : 0)}%`,
                          }}
                        />
                      </div>
                      <div className="flex h-full flex-1 flex-col justify-end">
                        <div
                          className="w-full rounded-t bg-emerald-600"
                          style={{
                            height: `${Math.max((item.vendorAverageMinutes / durationMax) * 100, item.vendorAverageMinutes > 0 ? 5 : 0)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {/* X軸ラベル */}
                <div className="mt-1.5 flex gap-2">
                  {durationSeries.map((item) => (
                    <div key={item.date} className="flex-1 text-center text-[10px] text-slate-400">
                      {formatShortDate(item.date)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl bg-white p-6 shadow" aria-labelledby="url-summary">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  URL Analytics
                </p>
                <h2 id="url-summary" className="mt-2 text-xl font-bold text-gray-900">
                  URL別の来訪者数と滞在時間
                </h2>
              </div>
              <p className="text-sm text-gray-500">
                対象日: {formatShortDate(latestDayPageAnalytics[0]?.visit_date ?? todayIso)}
              </p>
            </div>
            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100">
              <div className="grid grid-cols-[1.8fr_0.6fr_0.8fr_0.8fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span>URL</span>
                <span className="text-right">来訪者数</span>
                <span className="text-right">平均滞在</span>
                <span className="text-right">合計滞在</span>
              </div>
              {urlSummaries.length === 0 ? (
                <div className="px-4 py-8 text-sm text-slate-500">まだ URL 別の滞在データはありません。</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {urlSummaries.map((item) => (
                    <div
                      key={item.path}
                      className="grid grid-cols-[1.8fr_0.6fr_0.8fr_0.8fr] items-center gap-3 px-4 py-3 text-sm text-slate-700"
                    >
                      <span className="truncate font-medium text-slate-900">{item.path}</span>
                      <span className="text-right">{item.visitors}</span>
                      <span className="text-right">{formatMinutes(item.averageMinutes)}</span>
                      <span className="text-right">{formatMinutes(item.totalMinutes)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg bg-white p-6 shadow" role="region" aria-labelledby="recent-activity">
            <h2 id="recent-activity" className="mb-4 text-xl font-bold text-gray-900">
              最近のアクティビティ
            </h2>
            {recentActivities.length === 0 ? (
              <p className="text-sm text-gray-500">表示できる最新アクティビティはまだありません。</p>
            ) : (
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 border-b border-gray-100 pb-3 last:border-0">
                    <span className="text-2xl" aria-hidden="true">
                      {activity.icon}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{activity.text}</p>
                      <p className="mt-1 text-xs text-gray-500">{formatDateTime(activity.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="mt-4 text-xs text-slate-400">
          滞在時間と URL 別集計は、ページ離脱時に記録されるアクセスログをもとに集計しています。
        </div>
      </div>
    </AdminLayout>
  );
}
