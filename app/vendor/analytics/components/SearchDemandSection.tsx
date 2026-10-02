import { Badge, EmptyMessage, Surface } from "@/components/ui";
import type { SearchKeywordTrend } from "../../_types";

const LIMIT = 5;

/** いま日曜市で探されているもの。次に何を出すかの手がかり（自分の商品に当たるものに印をつける） */
export default function SearchDemandSection({ trends }: { trends: SearchKeywordTrend[] }) {
  const top = trends.slice(0, LIMIT);

  return (
    <Surface as="section" aria-labelledby="demand-title">
      <h2 id="demand-title" className="font-display text-xl text-nicchyo-ink">
        いま、探されているもの
      </h2>
      <p className="mt-1 text-sm text-nicchyo-ink/70">この1週間に、お客さんが検索した言葉です（日曜市ぜんぶ）</p>

      {top.length === 0 ? (
        <EmptyMessage message="まだ検索の記録がありません" padding="py-6" />
      ) : (
        <ol className="mt-4 divide-y divide-line">
          {top.map((item, index) => (
            <li key={item.keyword} className="flex items-center gap-3 py-3">
              <span className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-nicchyo-ink/40">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-base font-semibold text-nicchyo-ink">{item.keyword}</span>
              {item.matchesMyProducts && <Badge variant="amber">お店にある</Badge>}
              <span className="shrink-0 text-sm tabular-nums text-nicchyo-ink/70">{item.count}回</span>
            </li>
          ))}
        </ol>
      )}
    </Surface>
  );
}
