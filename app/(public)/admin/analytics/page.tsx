import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { AdminLayout, AdminPageHeader } from "@/components/admin";
import { getRole, isAdmin } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

function createAdminReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ---- format helpers ----
function fmtMinutes(sec: number) {
  if (!Number.isFinite(sec) || sec <= 0) return "0分0秒";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}分${s}秒`;
}

// パスを人間が読みやすいラベルに変換
const PATH_LABELS: Record<string, string> = {
  "/": "トップページ",
  "/map": "マップ",
  "/consult": "AIばあちゃん相談",
  "/my-shop": "マイショップ（出店者）",
  "/vendor/account": "出店者アカウント",
  "/vendor/menu": "出店者メニュー",
  "/login": "ログイン",
};

function pathLabel(path: string): { label: string; sub: string } {
  if (PATH_LABELS[path]) return { label: PATH_LABELS[path], sub: path };

  // /shop/[id] 系
  if (/^\/shop\//.test(path)) return { label: "店舗詳細ページ", sub: path };
  // /vendor/ 系
  if (/^\/vendor\//.test(path)) return { label: `出店者ページ（${path.replace("/vendor/", "")})`, sub: path };
  // /admin/ 系
  if (/^\/admin\//.test(path)) return { label: `管理画面（${path.replace("/admin/", "")})`, sub: path };
  // /moderator/ 系
  if (/^\/moderator/.test(path)) return { label: `モデレーター（${path.replace("/moderator/", "") || "ダッシュボード"})`, sub: path };

  return { label: path, sub: "" };
}

// ---- types ----
type PageAnalyticsRow = { visit_date: string; visitor_key: string; path: string; duration_seconds: number | null; user_role: string | null };
type ShopViewRow = { vendor_id: string; source: string | null; vendors: { shop_name: string | null } | null };
type SearchLogRow = { keyword: string; searched_at: string };
type ConsultLogRow = { intent_category: string | null; consulted_at: string };
type VendorCatRow = { categories: { name: string } | null };

export default async function AdminAnalyticsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  const role = getRole(user);
  if (!user || !isAdmin(role)) redirect("/login");

  const dc = createAdminReadClient() ?? supabase;

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const weekStartIso = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
  const monthStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const thirtyDaysAgoIso = new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10);
  const monthStartTs = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    pageAnalyticsResult,
    shopViewsResult,
    searchLogsResult,
    consultLogsResult,
    vendorCatsResult,
  ] = await Promise.all([
    // web_page_analytics: 過去30日分
    dc.from("web_page_analytics")
      .select("visit_date, visitor_key, path, duration_seconds, user_role")
      .gte("visit_date", thirtyDaysAgoIso)
      .lte("visit_date", todayIso),
    // shop_page_views: 今月分（vendors join）
    dc.from("shop_page_views")
      .select("vendor_id, source, vendors(shop_name)")
      .gte("viewed_at", monthStartTs),
    // product_search_logs: 過去7日分
    dc.from("product_search_logs")
      .select("keyword, searched_at")
      .gte("searched_at", `${weekStartIso}T00:00:00`),
    // ai_consult_logs: 今月分
    dc.from("ai_consult_logs")
      .select("intent_category, consulted_at")
      .gte("consulted_at", monthStartTs),
    // vendors + categories
    dc.from("vendors")
      .select("categories(name)"),
  ]);

  const pageRows = (pageAnalyticsResult.data ?? []) as PageAnalyticsRow[];
  const shopViews = (shopViewsResult.data ?? []) as unknown as ShopViewRow[];
  const searchLogs = (searchLogsResult.data ?? []) as SearchLogRow[];
  const consultLogs = (consultLogsResult.data ?? []) as ConsultLogRow[];
  const vendorCats = (vendorCatsResult.data ?? []) as unknown as VendorCatRow[];

  // 管理者アクセスを除外
  const userRows = pageRows.filter((r) => !isAdmin(r.user_role));

  // ---- アクセス統計 ----
  function uniqueVisitors(rows: typeof userRows, fromDate: string) {
    return new Set(rows.filter((r) => r.visit_date >= fromDate).map((r) => r.visitor_key)).size;
  }
  function avgStaySec(rows: typeof userRows, fromDate: string) {
    const byVisitor = new Map<string, number>();
    for (const r of rows) {
      if (r.visit_date < fromDate) continue;
      byVisitor.set(r.visitor_key, (byVisitor.get(r.visitor_key) ?? 0) + (r.duration_seconds ?? 0));
    }
    const vals = Array.from(byVisitor.values());
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }

  const todayVisitors = uniqueVisitors(userRows, todayIso);
  const weekVisitors = uniqueVisitors(userRows, weekStartIso);
  const monthVisitors = uniqueVisitors(userRows, monthStartIso);
  const todayAvgSec = avgStaySec(userRows, todayIso);
  const weekAvgSec = avgStaySec(userRows, weekStartIso);
  const monthAvgSec = avgStaySec(userRows, monthStartIso);
  const todayPageViews = userRows.filter((r) => r.visit_date === todayIso).length;
  const weekPageViews = userRows.filter((r) => r.visit_date >= weekStartIso).length;
  const monthPageViews = userRows.filter((r) => r.visit_date >= monthStartIso).length;

  // ---- 人気ページ（過去30日） ----
  const pathMap = new Map<string, Set<string>>();
  for (const r of userRows) {
    const set = pathMap.get(r.path) ?? new Set();
    set.add(r.visitor_key);
    pathMap.set(r.path, set);
  }
  const topPages = Array.from(pathMap.entries())
    .map(([path, visitors]) => ({ path, visitors: visitors.size }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 8);
  const maxPageVisitors = topPages[0]?.visitors ?? 1;

  // ---- 人気店舗（今月） ----
  const shopMap = new Map<string, { name: string; views: number; sourceMap: Record<string, number> }>();
  for (const r of shopViews) {
    const name = r.vendors?.shop_name ?? r.vendor_id;
    const entry = shopMap.get(r.vendor_id) ?? { name, views: 0, sourceMap: {} };
    entry.views++;
    if (r.source) entry.sourceMap[r.source] = (entry.sourceMap[r.source] ?? 0) + 1;
    shopMap.set(r.vendor_id, entry);
  }
  const topShops = Array.from(shopMap.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  // ---- 検索キーワード（過去7日） ----
  const kwMap = new Map<string, number>();
  for (const r of searchLogs) {
    kwMap.set(r.keyword, (kwMap.get(r.keyword) ?? 0) + 1);
  }
  const topKeywords = Array.from(kwMap.entries())
    .map(([kw, count]) => ({ kw, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const maxKwCount = topKeywords[0]?.count ?? 1;

  // ---- AI相談統計（今月） ----
  const totalConsults = consultLogs.length;
  const catMap = new Map<string, number>();
  for (const r of consultLogs) {
    const c = r.intent_category ?? "未分類";
    catMap.set(c, (catMap.get(c) ?? 0) + 1);
  }
  const topCategories = Array.from(catMap.entries())
    .map(([cat, count]) => ({ cat, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // ---- カテゴリー別店舗数 ----
  const catCountMap = new Map<string, number>();
  for (const r of vendorCats) {
    const name = r.categories?.name ?? "未分類";
    catCountMap.set(name, (catCountMap.get(name) ?? 0) + 1);
  }
  const categoryStats = Array.from(catCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const totalVendors = categoryStats.reduce((s, c) => s + c.count, 0);

  return (
    <AdminLayout>
      <AdminPageHeader eyebrow="Analytics" title="統計・分析" />

      <div className="mx-auto max-w-7xl px-4 py-8 pb-20">

        {/* アクセス概要 */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-slate-800">アクセス概要</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { label: "今日", visitors: todayVisitors, pageViews: todayPageViews, avgSec: todayAvgSec },
              { label: "今週（7日間）", visitors: weekVisitors, pageViews: weekPageViews, avgSec: weekAvgSec },
              { label: "今月", visitors: monthVisitors, pageViews: monthPageViews, avgSec: monthAvgSec },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="mb-3 text-sm font-semibold text-slate-500">{s.label}</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">ユニーク訪問者</p>
                    <p className="text-xl font-bold text-slate-800">{s.visitors.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">ページビュー</p>
                    <p className="text-xl font-bold text-slate-800">{s.pageViews.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">平均滞在時間</p>
                    <p className="text-base font-semibold text-slate-700">{fmtMinutes(s.avgSec)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* 人気ページ（過去30日） */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-bold text-slate-800">人気ページ</h2>
            <p className="mb-4 text-xs text-slate-400">過去30日・ユニーク訪問者数</p>
            {topPages.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">データがありません</p>
            ) : (
              <div className="space-y-3">
                {topPages.map((p, i) => {
                  const { label, sub } = pathLabel(p.path);
                  return (
                    <div key={p.path}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="w-5 shrink-0 text-xs font-semibold text-slate-400">{i + 1}.</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">{label}</p>
                            {sub && sub !== label && (
                              <p className="truncate text-xs text-slate-400">{sub}</p>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 text-sm text-slate-500">{p.visitors.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-indigo-600"
                          style={{ width: `${(p.visitors / maxPageVisitors) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 人気店舗（今月） */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-bold text-slate-800">人気店舗</h2>
            <p className="mb-4 text-xs text-slate-400">今月の閲覧数</p>
            {topShops.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">データがありません</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-100">
                <div className="grid grid-cols-[1.8fr_0.6fr_0.6fr] bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>店舗名</span>
                  <span className="text-right">閲覧数</span>
                  <span className="text-right">マップ流入</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {topShops.map((s, i) => (
                    <div key={i} className="grid grid-cols-[1.8fr_0.6fr_0.6fr] items-center px-4 py-2.5 text-sm">
                      <span className="truncate font-medium text-slate-800">{s.name}</span>
                      <span className="text-right text-slate-600">{s.views}</span>
                      <span className="text-right text-slate-500">{s.sourceMap["map"] ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 検索キーワード（過去7日） */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-bold text-slate-800">検索キーワード</h2>
            <p className="mb-4 text-xs text-slate-400">過去7日間の検索回数</p>
            {topKeywords.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">データがありません</p>
            ) : (
              <div className="space-y-3">
                {topKeywords.map((k, i) => (
                  <div key={k.kw}>
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-xs font-semibold text-slate-400">{i + 1}.</span>
                        <span className="text-sm font-medium text-slate-800">{k.kw}</span>
                      </div>
                      <span className="text-sm text-slate-500">{k.count}回</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{ width: `${(k.count / maxKwCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* AI相談統計（今月） */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-bold text-slate-800">AIばあちゃん相談統計</h2>
            <p className="mb-4 text-xs text-slate-400">今月の相談ログ</p>
            <div className="mb-4 flex items-center gap-3">
              <p className="text-4xl font-black text-indigo-600">{totalConsults.toLocaleString()}</p>
              <p className="text-sm text-slate-500">件の相談</p>
            </div>
            {topCategories.length === 0 ? (
              <p className="text-sm text-slate-400">カテゴリーデータがありません</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500">カテゴリー別</p>
                {topCategories.map((c) => (
                  <div key={c.cat} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-sm text-slate-700">{c.cat}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{c.count}</span>
                      <span className="text-xs text-slate-400">
                        ({totalConsults > 0 ? Math.round((c.count / totalConsults) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

        {/* カテゴリー別店舗数 */}
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-bold text-slate-800">カテゴリー別店舗数</h2>
          <p className="mb-4 text-xs text-slate-400">登録店舗 {totalVendors} 店</p>
          {categoryStats.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">データがありません</p>
          ) : (
            <div className="space-y-3">
              {categoryStats.map((c) => {
                const pct = totalVendors > 0 ? Math.round((c.count / totalVendors) * 100) : 0;
                return (
                  <div key={c.name}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">{c.name}</span>
                      <span className="text-sm text-slate-500">{c.count}店舗（{pct}%）</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </AdminLayout>
  );
}
