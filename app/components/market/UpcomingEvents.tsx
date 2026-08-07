import Link from "next/link";
import { formatEventDate, formatEventTime, type MarketEvent } from "@/lib/market/calendar";

type Props = {
  events: MarketEvent[];
  /** true のとき「すべて見る」リンクを出す（近況ページの抜粋表示用） */
  showMoreLink?: boolean;
  /** 見出しを出すか（カレンダーページ本体では不要） */
  showHeading?: boolean;
};

/**
 * 「これからの日曜市」= 運営・市役所発の予定。
 *
 * 出店者の近況フィードには混ぜず、独立したセクションとして下に置く。
 * 近況の鮮度表現（created_at で色あせる）は未来の予定に対して成立せず、
 * 混ぜると終わったイベントが最上位に鮮やかなまま居座るため。
 */
export default function UpcomingEvents({
  events,
  showMoreLink = false,
  showHeading = true,
}: Props) {
  return (
    <section className="mt-2">
      {showHeading && (
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-bold text-nicchyo-ink">これからの日曜市</h2>
          <span className="text-[11px] text-gray-400">運営からのお知らせ</span>
        </div>
      )}

      {events.length === 0 ? (
        <p className="rounded-2xl bg-white px-4 py-5 text-center text-xs text-gray-400 ring-1 ring-black/5">
          予定されているイベントはありません
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((event) => {
            const time = formatEventTime(event.start_time, event.end_time);
            return (
              <li
                key={event.id}
                className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-nicchyo-soft-green/30 px-2.5 py-1 text-[11px] font-bold text-nicchyo-ink">
                    {formatEventDate(event.event_date)}
                  </span>
                  {time && <span className="text-[11px] text-gray-400">{time}</span>}
                  {event.location && (
                    <span className="truncate text-[11px] text-gray-400">{event.location}</span>
                  )}
                </div>
                <h3 className="mt-2 text-[15px] font-bold leading-snug text-nicchyo-ink">
                  {event.title}
                </h3>
                {event.description && (
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                    {event.description}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showMoreLink && (
        <Link
          href="/calendar"
          prefetch={false}
          className="mt-3 flex items-center justify-center gap-1 text-xs font-semibold text-nicchyo-primary"
        >
          すべて見る
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </section>
  );
}
