import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  FileText,
  MessageSquare,
  MapPin,
  Store,
  Sun,
} from "lucide-react";
import { AdminLayout, AdminPageHeader, StatCard } from "@/components/admin";
import { createClient } from "@/utils/supabase/server";
import { getRole, isAdmin } from "@/lib/auth/permissions";
import type { DatabaseWithExtensions } from "@/types/database.extensions";

export const dynamic = "force-dynamic";

type ActivityItem = {
  id: string;
  text: string;
  timestamp: string | null;
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
  const record = user as { user_metadata?: { name?: string }; email?: string };
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

function formatMonthDay(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(date);
}

/** 次に開催予定の日曜（当日が日曜ならその日）を返す */
function getNextSundayIso(base: Date) {
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const daysUntilSunday = (7 - date.getDay()) % 7;
  date.setDate(date.getDate() + daysUntilSunday);
  return date.toISOString().slice(0, 10);
}

/** admin_notifications は生成済み型に含まれないため、拡張型のクライアントで扱う */
function createNotificationReadClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createServiceClient<DatabaseWithExtensions>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createAdminReadClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type TodoItem = {
  key: string;
  label: string;
  count: number;
  href: string;
  icon: typeof AlertTriangle;
  /** 件数ではなく「未設定」のように状態で示す項目のための表示 */
  valueLabel?: string;
};

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
  const nextSundayIso = getNextSundayIso(now);

  const [
    vendorsCountResult,
    activeContentsCountResult,
    landmarksCountResult,
    openReportsResult,
    openInquiriesResult,
    nextMarketDayResult,
    latestVendorsResult,
    latestContentsResult,
    latestLandmarksResult,
  ] = await Promise.all([
    dataClient.from("vendors").select("*", { count: "exact", head: true }),
    dataClient
      .from("vendor_contents")
      .select("*", { count: "exact", head: true })
      .gt("expires_at", now.toISOString()),
    dataClient.from("map_landmarks").select("*", { count: "exact", head: true }),
    dataClient
      .from("reports")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "in_review"]),
    dataClient
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "in_progress"]),
    dataClient.from("market_days").select("market_date, status").eq("market_date", nextSundayIso),
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

  const notificationClient = createNotificationReadClient();
  const unreadNotificationCount = notificationClient
    ? (
        await notificationClient
          .from("admin_notifications")
          .select("*", { count: "exact", head: true })
          .eq("is_read", false)
      ).count ?? 0
    : 0;

  const nextMarketDaySet =
    Array.isArray(nextMarketDayResult.data) && nextMarketDayResult.data.length > 0;

  const todos: TodoItem[] = [
    {
      key: "reports",
      label: "未対応の通報",
      count: openReportsResult.count ?? 0,
      href: "/admin/reports",
      icon: AlertTriangle,
    },
    {
      key: "inquiries",
      label: "未対応の問い合わせ",
      count: openInquiriesResult.count ?? 0,
      href: "/admin/inquiries",
      icon: MessageSquare,
    },
    {
      key: "notifications",
      label: "未読の通知",
      count: unreadNotificationCount,
      href: "/admin/notifications",
      icon: Bell,
    },
    {
      key: "market-day",
      label: `${formatMonthDay(nextSundayIso)}（日）の開催ステータス`,
      count: nextMarketDaySet ? 0 : 1,
      valueLabel: nextMarketDaySet ? "設定済み" : "未設定",
      href: "/admin/market-days",
      icon: Sun,
    },
  ];

  const pendingTodos = todos.filter((todo) => todo.count > 0);

  const stats = [
    { title: "登録店舗数", value: vendorsCountResult.count ?? 0, icon: Store },
    { title: "マップ上の建物", value: landmarksCountResult.count ?? 0, icon: MapPin },
    { title: "公開中のお知らせ", value: activeContentsCountResult.count ?? 0, icon: FileText },
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
    ...latestVendorRows.map((row) => ({
      id: `vendor-${row.id}`,
      text: `店舗「${row.shop_name ?? "名称未設定"}」が登録されました`,
      timestamp: row.created_at,
    })),
    ...latestContentRows.map((row) => ({
      id: `content-${row.id}`,
      text: `投稿「${row.title ?? "タイトル未設定"}」が作成されました`,
      timestamp: row.created_at,
    })),
    ...latestLandmarkRows.map((row) => ({
      id: `landmark-${row.key ?? row.name ?? row.created_at ?? "landmark"}`,
      text: `建物オブジェクト「${row.name ?? row.key ?? "名称未設定"}」が追加されました`,
      timestamp: row.created_at,
    })),
  ]
    .sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 6);

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="Dashboard"
        title="ダッシュボード"
        description={`${getDisplayName(user)}さん、今日の対応状況です。`}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 pb-20">
        {/* 対応が必要なこと：この画面で最初に見せるもの */}
        <section aria-labelledby="todo-heading">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="todo-heading" className="text-base font-bold text-slate-900">
              対応が必要なこと
            </h2>
            {pendingTodos.length > 0 && (
              <span className="text-[13px] text-slate-500">{pendingTodos.length}件</span>
            )}
          </div>

          {pendingTodos.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
              <p className="text-sm font-medium text-emerald-900">
                いま対応が必要な作業はありません。
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {pendingTodos.map((todo) => {
                const Icon = todo.icon;
                return (
                  <li key={todo.key}>
                    <Link
                      href={todo.href}
                      className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-slate-50"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">
                        {todo.label}
                      </span>
                      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[12px] font-semibold tabular-nums text-amber-900">
                        {todo.valueLabel ?? `${todo.count}件`}
                      </span>
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 全体の規模感。詳しい推移はアナリティクスへ */}
        <section className="mt-8" aria-labelledby="stats-heading">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="stats-heading" className="text-base font-bold text-slate-900">
              いまの登録状況
            </h2>
            <Link
              href="/admin/analytics"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              アクセス分析を見る
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map((stat) => (
              <StatCard key={stat.title} title={stat.title} value={stat.value} icon={stat.icon} />
            ))}
          </div>
        </section>

        {/* 最近の動き */}
        <section className="mt-8" aria-labelledby="recent-activity">
          <h2 id="recent-activity" className="mb-3 text-base font-bold text-slate-900">
            最近の動き
          </h2>
          <div className="rounded-xl border border-slate-200 bg-white">
            {recentActivities.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">
                表示できる最新の動きはまだありません。
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentActivities.map((activity) => (
                  <li key={activity.id} className="flex items-start gap-3 px-5 py-3.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-800">{activity.text}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {formatDateTime(activity.timestamp)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
