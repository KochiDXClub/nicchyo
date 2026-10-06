import { Surface } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { peakHour } from "@/lib/vendor/analyticsSummary";
import type { ShopViewSummary } from "../../_types";

const SOURCES = [
  { key: "map", label: "地図から", bar: "bg-amber-500" },
  { key: "search", label: "検索から", bar: "bg-amber-300" },
  { key: "direct", label: "QR・共有リンクなど", bar: "bg-nicchyo-ink/25" },
] as const;

/** いつ・どこから見られたか。見られた回数が無いあいだは出さない（一番上の案内で足りる） */
export default function ViewsSection({ views }: { views: ShopViewSummary }) {
  const peak = peakHour(views.hourly);
  const maxViews = peak?.views ?? 0;
  const totalSources = views.sources.map + views.sources.search + views.sources.direct;
  if (!peak) return null;

  return (
    <Surface as="section" aria-labelledby="views-title">
      <h2 id="views-title" className="font-display text-xl text-nicchyo-ink">
        いつ、どこから見られた？
      </h2>

      <p className="mt-3 text-base font-bold text-nicchyo-ink">
        {peak.hour}時台が、いちばん見られちょります
        <span className="ml-1 text-sm font-semibold text-nicchyo-ink/70">（{peak.views}回）</span>
      </p>
      <div
        className="mt-3 flex h-28 items-end gap-1"
        role="img"
        aria-label={`時間帯ごとの閲覧数。${views.hourly
          .filter((item) => item.views > 0)
          .map((item) => `${item.hour}時 ${item.views}回`)
          .join("、")}`}
      >
        {views.hourly.map((item) => (
          <div key={item.hour} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div
              className={cn("w-full rounded-t-btn", item.hour === peak.hour ? "bg-amber-500" : "bg-amber-200")}
              style={{ height: `${Math.max(item.views > 0 ? 6 : 2, (item.views / maxViews) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1" aria-hidden="true">
        {views.hourly.map((item) => (
          <span key={item.hour} className="min-w-0 flex-1 text-center text-[10px] text-nicchyo-ink/55">
            {item.hour}
          </span>
        ))}
      </div>
      <p className="mt-1 text-right text-[11px] text-nicchyo-ink/55">時</p>

      <div className="mt-5 border-t border-line pt-4">
        <h3 className="text-sm font-bold text-nicchyo-ink/70">どこから見られた？</h3>
        <div className="mt-2 flex h-3 overflow-hidden rounded-chip bg-nicchyo-ink/10" aria-hidden="true">
          {SOURCES.map((source) => (
            <div
              key={source.key}
              className={source.bar}
              style={{ width: `${(views.sources[source.key] / totalSources) * 100}%` }}
            />
          ))}
        </div>
        <ul className="mt-3 flex flex-col gap-1.5">
          {SOURCES.map((source) => (
            <li key={source.key} className="flex items-center gap-2 text-sm">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-chip", source.bar)} aria-hidden="true" />
              <span className="flex-1 text-nicchyo-ink/70">{source.label}</span>
              <span className="font-bold tabular-nums text-nicchyo-ink">
                {Math.round((views.sources[source.key] / totalSources) * 100)}%
              </span>
              <span className="w-10 text-right text-xs tabular-nums text-nicchyo-ink/55">
                {views.sources[source.key]}回
              </span>
            </li>
          ))}
        </ul>
      </div>
      {views.sampled && (
        <p className="mt-4 text-[11px] leading-relaxed text-nicchyo-ink/55">
          見られた回数が多いため、時間帯と流入元は、直近の{views.hourly.reduce((sum, item) => sum + item.views, 0)}回から数えています。
        </p>
      )}
    </Surface>
  );
}
