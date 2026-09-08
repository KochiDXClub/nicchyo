import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import VisitorTrendSwitcher from "./VisitorTrendSwitcher";
import NavigationBar from "@/app/components/NavigationBar";
import { MARKET_STATUS, type MarketStatus } from "./chart";
import { LayerHeading, SectionCard, StatTile } from "./components/ui";
import MarketDaysHeatmap, { type MarketDayPoint } from "./components/MarketDaysHeatmap";
import { HourlyDirectionChart, PreVisitHours, ReachProfile } from "./components/MovementCharts";
import { CategoryBars, DistrictMatrix, type CategoryCount } from "./components/ShopComposition";
import SeasonCalendar from "./components/SeasonCalendar";
import AboutData, { type CoverageItem } from "./components/AboutData";
import {
  DEMO_CATEGORY_MATRIX,
  DEMO_COVERAGE,
  DEMO_HOURLY_DIRECTION,
  DEMO_PREVISIT_HOURS,
  DEMO_REACH,
  DEMO_SEASON_CALENDAR,
  DEMO_TURNAROUND,
  DISTRICTS,
  buildDemoMarketDays,
} from "./demoData";

type VisitorChartPoint = { key: string; label: string; value: number; trend: number };

export const revalidate = 3600;

// ── 日付ユーティリティ（すべて Asia/Tokyo 基準） ────────────────────────

function getTokyoTodayIso(baseDate = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(baseDate);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function formatJapaneseDate(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00+09:00`);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function toUtcDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00Z`);
}

function isoFromUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftIsoDays(isoDate: string, days: number) {
  const date = toUtcDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return isoFromUtcDate(date);
}

/** 当日が日曜ならその日、そうでなければ次の日曜。 */
function getUpcomingSundayIso(isoDate: string) {
  const date = toUtcDate(isoDate);
  const shift = (7 - date.getUTCDay()) % 7;
  return shiftIsoDays(isoDate, shift);
}

function formatMonthDayLabel(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00+09:00`);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function getWeekStartIso(isoDate: string) {
  const date = toUtcDate(isoDate);
  const day = date.getUTCDay();
  const shift = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + shift);
  return isoFromUtcDate(date);
}

function shiftMonthKey(monthKey: string, delta: number) {
  const [yearText, monthText] = monthKey.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1 + delta, 1));
  return `${date.getUTCFullYear().toString().padStart(4, "0")}-${(date.getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}`;
}

function addTrend(points: Omit<VisitorChartPoint, "trend">[]) {
  return points.map((point, index) => {
    const values = points.slice(Math.max(0, index - 2), index + 1).map((item) => item.value);
    return { ...point, trend: values.reduce((sum, value) => sum + value, 0) / values.length };
  });
}

function buildDailySeries(todayIso: string, byDate: Map<string, number>, days = 14) {
  const points = Array.from({ length: days }, (_, i) => {
    const key = shiftIsoDays(todayIso, -(days - 1 - i));
    return { key, label: formatMonthDayLabel(key), value: byDate.get(key) ?? 0 };
  });
  return addTrend(points);
}

function buildBucketedSeries(
  keys: string[],
  labels: string[],
  byBucket: Map<string, number>
) {
  return addTrend(
    keys.map((key, index) => ({ key, label: labels[index], value: byBucket.get(key) ?? 0 }))
  );
}

function bucketBy(byDate: Map<string, number>, toKey: (date: string) => string) {
  const result = new Map<string, number>();
  byDate.forEach((value, date) => {
    const key = toKey(date);
    result.set(key, (result.get(key) ?? 0) + value);
  });
  return result;
}

// ── データ取得 ──────────────────────────────────────────────────────────

type VendorRow = {
  category_id: string | null;
  main_products: string[] | null;
  payment_methods: string[] | null;
  rain_policy: string | null;
  business_hours_start: string | null;
};

type FetchedData = {
  categoryCounts: CategoryCount[];
  vendorTotal: number;
  categoryTotal: number;
  coverage: { mainProducts: number; hours: number; payment: number; rainPolicy: number };
  landmarks: { total: number; verified: number } | null;
  marketDays: MarketDayPoint[];
  upcomingStatus: { status: MarketStatus; note: string | null } | null;
  visitorsByDate: Map<string, number>;
  visitorError: boolean;
};

const EMPTY: FetchedData = {
  categoryCounts: [],
  vendorTotal: 0,
  categoryTotal: 0,
  coverage: { mainProducts: 0, hours: 0, payment: 0, rainPolicy: 0 },
  landmarks: null,
  marketDays: [],
  upcomingStatus: null,
  visitorsByDate: new Map(),
  visitorError: false,
};

/**
 * 実データの取得。1つのクエリが失敗しても、他のセクションは表示できるようにする
 * （このページは「何が埋まっていて何が埋まっていないか」を見せるのが目的なので、
 *   取れなかったことも含めて表示できたほうがよい）。
 */
async function fetchAnalysisData(todayIso: string, historyStartIso: string): Promise<FetchedData> {
  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!hasSupabaseEnv) return EMPTY;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const [categoriesResult, vendorsResult, visitorsResult, marketDaysResult, landmarksResult] =
    await Promise.allSettled([
      supabase.from("categories").select("id, name"),
      supabase
        .from("vendors")
        .select("category_id, main_products, payment_methods, rain_policy, business_hours_start"),
      supabase
        .from("web_visitor_stats")
        .select("visit_date, visitor_count")
        .gte("visit_date", historyStartIso)
        .order("visit_date", { ascending: true }),
      supabase
        .from("market_days")
        .select("market_date, status, note")
        .gte("market_date", historyStartIso)
        .order("market_date", { ascending: true }),
      supabase.from("map_landmarks").select("key, verified"),
    ]);

  const data: FetchedData = { ...EMPTY, coverage: { ...EMPTY.coverage }, visitorsByDate: new Map() };

  const categoryNameById = new Map<string, string>();
  if (categoriesResult.status === "fulfilled" && !categoriesResult.value.error) {
    const rows = (categoriesResult.value.data ?? []) as { id: string; name: string | null }[];
    rows.forEach((row) => {
      if (row.id) categoryNameById.set(row.id, row.name?.trim() || "未分類");
    });
    data.categoryTotal = rows.length;
  }

  if (vendorsResult.status === "fulfilled" && !vendorsResult.value.error) {
    const vendors = (vendorsResult.value.data ?? []) as VendorRow[];
    data.vendorTotal = vendors.length;

    const countByName = new Map<string, number>();
    vendors.forEach((vendor) => {
      const name = vendor.category_id
        ? categoryNameById.get(vendor.category_id) ?? "未分類"
        : "未分類";
      countByName.set(name, (countByName.get(name) ?? 0) + 1);
      if (vendor.main_products && vendor.main_products.length > 0) data.coverage.mainProducts += 1;
      if (vendor.business_hours_start) data.coverage.hours += 1;
      if (vendor.payment_methods && vendor.payment_methods.length > 0) data.coverage.payment += 1;
      if (vendor.rain_policy) data.coverage.rainPolicy += 1;
    });

    data.categoryCounts = Array.from(countByName.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  if (visitorsResult.status === "fulfilled" && !visitorsResult.value.error) {
    const rows = (visitorsResult.value.data ?? []) as {
      visit_date: string;
      visitor_count: number | null;
    }[];
    rows.forEach((row) => {
      if (row.visit_date) data.visitorsByDate.set(row.visit_date, row.visitor_count ?? 0);
    });
  } else {
    data.visitorError = true;
  }

  if (marketDaysResult.status === "fulfilled" && !marketDaysResult.value.error) {
    const rows = (marketDaysResult.value.data ?? []) as {
      market_date: string;
      status: string | null;
      note: string | null;
    }[];
    data.marketDays = rows
      .filter((row) => row.market_date && row.status && row.status in MARKET_STATUS)
      .map((row) => ({ date: row.market_date, status: row.status as MarketStatus }));

    const upcomingIso = getUpcomingSundayIso(todayIso);
    const upcoming = rows.find((row) => row.market_date === upcomingIso);
    if (upcoming && upcoming.status && upcoming.status in MARKET_STATUS) {
      data.upcomingStatus = { status: upcoming.status as MarketStatus, note: upcoming.note };
    }
  }

  if (landmarksResult.status === "fulfilled" && !landmarksResult.value.error) {
    const rows = (landmarksResult.value.data ?? []) as { verified: boolean | null }[];
    data.landmarks = {
      total: rows.length,
      verified: rows.filter((row) => row.verified).length,
    };
  }

  return data;
}

// ── ページ ──────────────────────────────────────────────────────────────

export default async function AnalysisPage() {
  const todayIso = getTokyoTodayIso();
  const currentYear = Number(todayIso.slice(0, 4));
  const historyStartIso = `${currentYear - 4}-01-01`;
  const upcomingSundayIso = getUpcomingSundayIso(todayIso);
  const currentMonth = Number(todayIso.slice(5, 7));

  const data = await fetchAnalysisData(todayIso, historyStartIso);

  // 開催実績は、実データが年単位のヒートマップとして読める量になるまではデモを見せる。
  const hasRealMarketHistory = data.marketDays.length >= 20;
  const marketDays = hasRealMarketHistory ? data.marketDays : buildDemoMarketDays(todayIso, 5);

  const hasRealCategories = data.categoryCounts.length > 0;

  const todayVisitors = data.visitorsByDate.get(todayIso) ?? null;
  const dailyChart = buildDailySeries(todayIso, data.visitorsByDate, 14);
  const weeklyChart = buildBucketedSeries(
    Array.from({ length: 12 }, (_, i) => shiftIsoDays(getWeekStartIso(todayIso), -7 * (11 - i))),
    Array.from({ length: 12 }, (_, i) =>
      `${formatMonthDayLabel(shiftIsoDays(getWeekStartIso(todayIso), -7 * (11 - i)))}週`
    ),
    bucketBy(data.visitorsByDate, getWeekStartIso)
  );
  const monthlyChart = buildBucketedSeries(
    Array.from({ length: 12 }, (_, i) => shiftMonthKey(todayIso.slice(0, 7), -(11 - i))),
    Array.from({ length: 12 }, (_, i) =>
      shiftMonthKey(todayIso.slice(0, 7), -(11 - i)).replace("-", "/")
    ),
    bucketBy(data.visitorsByDate, (date) => date.slice(0, 7))
  );
  const yearlyChart = buildBucketedSeries(
    Array.from({ length: 5 }, (_, i) => String(currentYear - (4 - i))),
    Array.from({ length: 5 }, (_, i) => `${currentYear - (4 - i)}年`),
    bucketBy(data.visitorsByDate, (date) => date.slice(0, 4))
  );

  const upcoming = data.upcomingStatus;
  const upcomingSpec = upcoming ? MARKET_STATUS[upcoming.status] : null;

  // カバレッジは、実データが取れないときも「どう見えるか」が分かるように見本を出す。
  // ただし実データと取り違えられないよう、項目ごとにデモの印を付ける。
  const hasVendorData = data.vendorTotal > 0;
  const hasLandmarkData = !!data.landmarks;
  const vendorTotal = hasVendorData ? data.vendorTotal : DEMO_COVERAGE.vendorTotal;
  const vendorFilled = hasVendorData ? data.coverage : DEMO_COVERAGE;
  const landmarkTotal = data.landmarks?.total ?? DEMO_COVERAGE.landmarkTotal;
  const landmarkVerified = data.landmarks?.verified ?? DEMO_COVERAGE.landmarkVerified;
  const categoryTotal = data.categoryTotal > 0 ? data.categoryTotal : DEMO_CATEGORY_MATRIX.length;

  const coverage: CoverageItem[] = [
    {
      label: "主要商品が登録されている店舗",
      filled: vendorFilled.mainProducts,
      total: vendorTotal,
      demo: !hasVendorData,
      note: "旬カレンダーとカテゴリ別の集計は、ここが埋まっている店舗だけを見ています。",
    },
    {
      label: "営業時間が登録されている店舗",
      filled: vendorFilled.hours,
      total: vendorTotal,
      demo: !hasVendorData,
      note: "時間帯の分析を現地の営業実態と突き合わせるために必要です。",
    },
    {
      label: "支払い方法が登録されている店舗",
      filled: vendorFilled.payment,
      total: vendorTotal,
      demo: !hasVendorData,
      note: "現金以外が使えるかどうかは、来訪者の準備に直結します。",
    },
    {
      label: "雨天時の対応が登録されている店舗",
      filled: vendorFilled.rainPolicy,
      total: vendorTotal,
      demo: !hasVendorData,
      note: "開催実績と組み合わせると、荒天時に何割の店が出るのかが分かります。",
    },
    {
      label: "位置を実地確認したスポット",
      filled: landmarkVerified,
      total: landmarkTotal,
      demo: !hasLandmarkData,
      note: "トイレ・休憩場所・電停など。未確認のものは、地図上でもその旨を添えています。",
    },
  ];

  return (
    <>
      <main className="min-h-screen bg-[#FAFAF8] px-5 py-12 pb-28 text-amber-950 md:px-6">
        <div className="mx-auto max-w-5xl">
          <header className="text-center">
            <p className="text-xs font-semibold tracking-[0.2em] text-amber-700/80">
              NICCHYO ANALYTICS
            </p>
            <h1 className="mt-3 text-3xl font-bold text-amber-900 md:text-4xl">
              日曜市をデータで見る
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-amber-900/70">
              日曜市について nicchyo が記録していることを、そのまま公開しています。
              誰でも引用できるように、数字の定義と、その数字がどこまでを表しているのかを併記します。
            </p>
          </header>

          {/* デモ表示の告知。実データとサンプル値が混ざって見えると、
              このページが目指していることの逆になるため、最上部で明示する。 */}
          <aside
            role="note"
            className="mt-8 rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50/70 p-4 md:p-5"
          >
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-rose-800">
              <span aria-hidden="true">◆</span>
              このページは開発中のデモです
            </p>
            <p className="mt-2 text-sm leading-relaxed text-rose-900/85">
              <span className="font-semibold">◆ デモ</span> の印が付いた数字は、
              「どう見えるようになるか」を示すためのサンプル値で、実際に計測したものではありません。
              <span className="font-semibold">● 実データ</span> の印が付いたものだけが、
              いま実際に記録されている値です。引用にはまだ使えません。
            </p>
          </aside>

          {/* ── 層1：いま ───────────────────────────────────────────── */}
          <LayerHeading
            step="LAYER 1"
            title="いま"
            lead="今週の日曜市と、いま登録されている店舗の姿。日曜市に行く人のための数字です。"
          />

          <div className="space-y-4">
            <SectionCard
              title="今週の開催"
              description={`${formatJapaneseDate(upcomingSundayIso)} の開催ステータスです。`}
              live={!!upcoming}
              footnote="運営が更新した時点で公開されます。まだ登録がない場合は、通常どおり開催の予定です（確定情報ではありません）。"
            >
              {upcoming && upcomingSpec ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold text-white"
                    style={{ backgroundColor: upcomingSpec.color }}
                  >
                    {upcomingSpec.glyph ? <span aria-hidden="true">{upcomingSpec.glyph}</span> : null}
                    {upcomingSpec.label}
                  </span>
                  {upcoming.note ? (
                    <span className="text-sm text-amber-900/80">{upcoming.note}</span>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-amber-900/70">
                  この日の開催ステータスは、まだ登録されていません。
                </p>
              )}
            </SectionCard>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="登録店舗数"
                value={vendorTotal.toLocaleString()}
                unit="店"
                demo={!hasVendorData}
                sub="nicchyo に登録のある出店者。日曜市の全出店者数ではありません。"
              />
              <StatTile
                label="カテゴリ数"
                value={String(categoryTotal)}
                unit="種類"
                demo={data.categoryTotal === 0}
                sub="出店を分類している区分の数。"
              />
              <StatTile
                label="主要商品の登録率"
                value={((vendorFilled.mainProducts / vendorTotal) * 100).toFixed(1)}
                unit="%"
                demo={!hasVendorData}
                sub={`${vendorFilled.mainProducts} / ${vendorTotal} 店`}
              />
              <StatTile
                label="位置確認済みスポット"
                value={String(landmarkVerified)}
                unit={`/ ${landmarkTotal}`}
                demo={!hasLandmarkData}
                sub="トイレ・休憩場所・電停などのうち、実地で位置を確認したもの。"
              />
            </div>

            <SectionCard
              title="カテゴリ別の出店構成"
              description="登録されている店舗を、カテゴリごとに数えたものです。"
              demo={!hasRealCategories}
              live={hasRealCategories}
              footnote={
                hasRealCategories
                  ? "カテゴリが設定されていない店舗は「未分類」に入ります。日曜市の全出店者ではなく、nicchyo に登録のある店舗の構成です。"
                  : "登録データを取得できなかったため、サンプル値を表示しています。"
              }
            >
              <CategoryBars
                data={
                  hasRealCategories
                    ? data.categoryCounts
                    : DEMO_CATEGORY_MATRIX.map((row) => ({
                        name: row.category,
                        count: row.counts.reduce((sum, value) => sum + value, 0),
                      })).sort((a, b) => b.count - a.count)
                }
              />
            </SectionCard>

            <SectionCard
              title="今月の旬"
              description="日曜市に並ぶ品目と、その旬の時期です。"
              demo
              footnote="products と product_seasons のデータ整備が済むまではサンプル値です。整備後は、実際に登録された品目に置き換わります。"
            >
              <SeasonCalendar rows={DEMO_SEASON_CALENDAR} currentMonth={currentMonth} />
            </SectionCard>
          </div>

          {/* ── 層2：記録 ───────────────────────────────────────────── */}
          <LayerHeading
            step="LAYER 2"
            title="記録"
            lead="続けている間しか作れない記録です。行政・研究・報道など、日曜市を外から見る人のために残しています。"
          />

          <div className="space-y-4">
            <SectionCard
              title="開催実績カレンダー"
              description="1つのマスが1回の日曜です。荒天中止・特別開催・臨時休市を色と記号で分けています。"
              demo={!hasRealMarketHistory}
              live={hasRealMarketHistory}
              footnote={
                hasRealMarketHistory
                  ? "運営が登録した開催ステータスの記録です。登録のない日は空欄になります。"
                  : "過去分の開催記録がまだ入力されていないため、サンプル値を表示しています。実データは、過去の記録を遡って入力するところから始めます。気象データと突き合わせれば「どのくらいの雨で中止になるか」が言えるようになります。"
              }
            >
              <MarketDaysHeatmap days={marketDays} />
            </SectionCard>

            <SectionCard
              title="時間帯と歩く向き"
              description="時間帯ごとに、西へ向かう人と東へ向かう人がどれくらいいたか。中央が0で、左が西向き、右が東向きです。"
              demo
              footnote="店舗タップの並びから推定する想定の値です。人数ではなく「向きの変化の回数」を数えます。集計はまだ実装しておらず、個人が特定される粒度のデータは残しません。"
            >
              <HourlyDirectionChart data={DEMO_HOURLY_DIRECTION} />
            </SectionCard>

            <SectionCard
              title="入口・到達率・折り返し地点"
              description="どちらの端から入って、どこまで歩き、どこで引き返すか。丁目単位で見ています。"
              demo
              footnote="店舗単位では出しません（個店の人気ランキングになってしまうため）。到達率は「回り方の効率」を測るものではなく、端の出店者が構造的に不利になっていないかを見るための数字です。"
            >
              <ReachProfile rows={DEMO_REACH} turnaround={DEMO_TURNAROUND} />
            </SectionCard>

            <SectionCard
              title="カテゴリ × 丁目"
              description="どのあたりに、何のお店が集まっているか。"
              demo
              footnote="location_assignments と market_locations から日付付きで算出できますが、集計はまだ実装していません。今の値はサンプルです。"
            >
              <DistrictMatrix districts={DISTRICTS} rows={DEMO_CATEGORY_MATRIX} />
            </SectionCard>

            <SectionCard
              title="行く前に調べている時間帯"
              description="土曜の夜から日曜の朝にかけての利用。現地での利用とは分けて数えます。"
              demo
              footnote="開催情報やお知らせを、いつ出せば届くのかを見るための数字です。現地での利用と混ぜると、どちらの意味も読めなくなります。"
            >
              <PreVisitHours data={DEMO_PREVISIT_HOURS} />
            </SectionCard>

            <SectionCard
              title="Web 来訪者数"
              description={`${formatJapaneseDate(todayIso)} 時点。nicchyo を開いた端末の数です。`}
              live={!data.visitorError}
              footnote="これは現地の来場者数ではなく、nicchyo の利用者数です。スマホを持ち、検索して調べる人だけが数えられているため、日曜市の来場者を代表するものではありません。現地での定点観測と突き合わせるまでは、来場者数の推定には使えません。"
            >
              <p className="text-3xl font-bold text-amber-900 md:text-4xl">
                {todayVisitors !== null ? todayVisitors.toLocaleString() : "データ未登録"}
                {todayVisitors !== null ? (
                  <span className="ml-1.5 text-base font-semibold text-amber-900/70">人</span>
                ) : null}
              </p>
              {data.visitorError ? (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  来訪者数の取得に失敗しました。
                </p>
              ) : null}
              <div className="mt-5">
                <VisitorTrendSwitcher
                  dailyChart={dailyChart}
                  weeklyChart={weeklyChart}
                  monthlyChart={monthlyChart}
                  yearlyChart={yearlyChart}
                />
              </div>
            </SectionCard>
          </div>

          {/* ── 層3：このデータについて ─────────────────────────────── */}
          <LayerHeading
            step="LAYER 3"
            title="このデータについて"
            lead="数字そのものより、その数字がどう作られたかのほうが大事です。定義・母数・偏り・ライセンスをここにまとめます。"
          />

          <AboutData coverage={coverage} />

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="rounded-full border border-amber-200 bg-white px-5 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-50"
            >
              ホームへ戻る
            </Link>
            <Link
              href="/map"
              className="rounded-full bg-amber-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-800"
            >
              マップを見る
            </Link>
          </div>
        </div>
      </main>
      <NavigationBar activeHref="/analysis" />
    </>
  );
}
