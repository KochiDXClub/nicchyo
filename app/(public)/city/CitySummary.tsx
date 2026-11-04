import { cookies } from "next/headers";
import Link from "next/link";
import { Download } from "lucide-react";
import { Surface, buttonClass } from "@/components/ui";
import { createClient } from "@/utils/supabase/server";
import { fetchCityDataset, type CityDatasetKind } from "@/lib/city/datasets.server";
import { summariseMarketDays, summariseVisitors } from "@/lib/city/summary";
import { getStatusPresentation, type MarketDayStatus } from "@/lib/market/calendar";
import { todayJstString } from "@/lib/time/jstDate";

const STATUS_ORDER: MarketDayStatus[] = ["open", "special", "cancelled", "closed"];

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="text-xs text-nicchyo-ink/60">{label}</p>
      <p className="mt-1 text-2xl font-bold text-nicchyo-ink">{value}</p>
      {note ? <p className="mt-0.5 text-xs text-nicchyo-ink/50">{note}</p> : null}
    </div>
  );
}

function CsvLink({ type, label }: { type: CityDatasetKind; label: string }) {
  return (
    <a href={`/api/city/export?type=${type}`} className={buttonClass({ variant: "quiet", size: "sm" })}>
      <Download className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );
}

const FETCH_FAILED = "読み込めませんでした。時間をおいて再度お試しください。";

/**
 * 高知市向けの閲覧用まとめ。数字は来訪者が /analysis で見られるものと同じ範囲の集計だけ
 * （本人のセッションで取得するので、RLS が許す範囲を超えない）。
 */
export async function CitySummary() {
  const supabase = createClient(await cookies());
  const today = todayJstString();
  const year = Number(today.slice(0, 4));

  const [visitors, marketDays, categories] = await Promise.allSettled([
    fetchCityDataset(supabase, "visitors", today),
    fetchCityDataset(supabase, "market-days", today),
    fetchCityDataset(supabase, "categories", today),
  ]);

  const visitorSummary = visitors.status === "fulfilled" ? summariseVisitors(visitors.value.rows, today) : null;
  const marketSummary =
    marketDays.status === "fulfilled" ? summariseMarketDays(marketDays.value.rows, year, today) : null;
  const categoryRows =
    categories.status === "fulfilled"
      ? (categories.value.rows as { category: string; count: number }[])
      : null;
  const vendorTotal = categoryRows?.reduce((sum, r) => sum + r.count, 0) ?? null;

  return (
    <section aria-labelledby="city-summary-heading" className="space-y-3">
      <div>
        <h2 id="city-summary-heading" className="text-base font-bold text-nicchyo-ink">
          利用状況と日曜市の記録
        </h2>
        <p className="mt-1 text-sm text-nicchyo-ink/70">
          集計済みの数字だけを表示しています。詳しくは
          <Link href="/analysis" className="underline">
            日曜市をデータで見る
          </Link>
          もご覧ください。
        </p>
      </div>

      <Surface padding="md">
        <h3 className="mb-3 text-sm font-bold text-nicchyo-ink">Web の来訪者数（直近28日）</h3>
        {visitorSummary ? (
          <div className="grid grid-cols-2 gap-4">
            <Stat label="合計" value={`${visitorSummary.total28.toLocaleString("ja-JP")}人`} />
            <Stat
              label="1日あたり"
              value={`${visitorSummary.average28.toLocaleString("ja-JP")}人`}
              note={`記録のある${visitorSummary.recordedDays}日の平均`}
            />
          </div>
        ) : (
          <p className="text-sm text-nicchyo-ink/60">
            {visitors.status === "rejected" ? FETCH_FAILED : "表示できる記録がありません。"}
          </p>
        )}
        <p className="mt-3 text-xs text-nicchyo-ink/50">※現地の来場者数ではなく、Web を開いた人数です。</p>
        <div className="mt-3">
          <CsvLink type="visitors" label="日別の来訪者数（CSV）" />
        </div>
      </Surface>

      <Surface padding="md">
        <h3 className="mb-3 text-sm font-bold text-nicchyo-ink">{year}年の開催実績（記録のある回）</h3>
        {marketSummary ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {STATUS_ORDER.map((status) => (
              <Stat
                key={status}
                label={getStatusPresentation(status).label}
                value={`${marketSummary[status]}回`}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-nicchyo-ink/60">
            {marketDays.status === "rejected" ? FETCH_FAILED : `${year}年の開催状況は、まだ記録がありません。`}
          </p>
        )}
        {marketSummary ? (
          <p className="mt-3 text-xs text-nicchyo-ink/50">
            ※記録のある回だけの数です。記録のない回は含みません。
          </p>
        ) : null}
        <div className="mt-3">
          <CsvLink type="market-days" label="開催状況（CSV・今後の予定を含む）" />
        </div>
      </Surface>

      <Surface padding="md">
        <h3 className="mb-3 text-sm font-bold text-nicchyo-ink">
          カテゴリ別の出店数{vendorTotal !== null ? `（計${vendorTotal.toLocaleString("ja-JP")}店）` : ""}
        </h3>
        {categoryRows && categoryRows.length > 0 ? (
          <ul className="divide-y divide-line text-sm">
            {categoryRows.map((row) => (
              <li key={row.category} className="flex justify-between py-2">
                <span className="text-nicchyo-ink">{row.category}</span>
                <span className="text-nicchyo-ink/70">{row.count.toLocaleString("ja-JP")}店</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-nicchyo-ink/60">
            {categories.status === "rejected" ? FETCH_FAILED : "表示できる記録がありません。"}
          </p>
        )}
        <div className="mt-3">
          <CsvLink type="categories" label="カテゴリ別の出店数（CSV）" />
        </div>
      </Surface>
    </section>
  );
}
