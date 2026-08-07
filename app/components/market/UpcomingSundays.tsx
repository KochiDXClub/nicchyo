import Link from "next/link";
import Image from "next/image";
import {
  formatEventPeriod,
  formatEventTime,
  getCategoryPresentation,
  getStatusPresentation,
  type MarketEvent,
  type MarketSunday,
} from "@/lib/market/calendar";

type Props = {
  sundays: MarketSunday[];
  /** true のとき「すべて見る」リンクを出す（近況ページの抜粋表示用） */
  showMoreLink?: boolean;
  showHeading?: boolean;
};

/**
 * 「これからの日曜市」= 運営・市役所発の予定を、日曜ごとのカードで見せる。
 *
 * 月間グリッドにしない理由：日曜市は毎週日曜しか開かないため、
 * カレンダーのマス目は6/7が必ず空白になり情報密度が下がる。
 * 予定が無い日曜もカードとして残すことで「開催はする」という情報になる。
 *
 * 出店者の近況フィードには混ぜず独立したセクションとして置く。
 * 近況の鮮度表現（created_at で退色）は未来の予定に対して成立しないため。
 */
export default function UpcomingSundays({
  sundays,
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

      <ul className="flex flex-col gap-2.5">
        {sundays.map((sunday) => (
          <SundayCard key={sunday.dateIso} sunday={sunday} />
        ))}
      </ul>

      {showMoreLink && (
        <Link
          href="/calendar"
          prefetch={false}
          className="mt-3 flex items-center justify-center gap-1 text-xs font-semibold text-nicchyo-primary"
        >
          すべて見る
          <ChevronIcon className="h-3.5 w-3.5" />
        </Link>
      )}
    </section>
  );
}

function SundayCard({ sunday }: { sunday: MarketSunday }) {
  const { day, highlight, events, isThisWeek } = sunday;
  const status = day?.status ?? "open";
  const statusPresentation = getStatusPresentation(status);
  // 通常開催はいちいちバッジを出さない（例外だけを目立たせる）
  const showStatusBadge = status !== "open";
  const isEmpty = !highlight && events.length === 0;

  return (
    <li
      className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ${
        isThisWeek ? "ring-nicchyo-primary/40" : "ring-black/5"
      }`}
    >
      {/* 日付ヘッダー */}
      <div
        className={`flex items-center gap-2 px-4 py-2.5 ${
          isThisWeek ? "bg-nicchyo-primary/10" : "bg-black/[0.02]"
        }`}
      >
        <span className="text-sm font-bold text-nicchyo-ink">{sunday.dateLabel}</span>
        <span className="text-[11px] text-gray-400">{sunday.relativeLabel}</span>
        {showStatusBadge && (
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${
              statusPresentation.tone === "alert"
                ? "bg-rose-500 text-white"
                : "bg-nicchyo-accent text-nicchyo-ink"
            }`}
          >
            {statusPresentation.label}
          </span>
        )}
      </div>

      {day?.note && (
        <p className="border-b border-black/5 bg-rose-50/60 px-4 py-2 text-xs leading-relaxed text-rose-700">
          {day.note}
        </p>
      )}

      <div className="px-4 py-3">
        {isEmpty ? (
          <p className="text-xs text-gray-400">まだ予定はありません</p>
        ) : (
          <>
            {highlight && <HighlightItem event={highlight} />}
            {events.length > 0 && (
              <ul className={`flex flex-col gap-2.5 ${highlight ? "mt-3" : ""}`}>
                {events.map((event) => (
                  <EventItem key={event.id} event={event} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </li>
  );
}

/** その日の見どころ。写真があれば大きく出して来店理由にする */
function HighlightItem({ event }: { event: MarketEvent }) {
  const { label, emoji } = getCategoryPresentation(event.category);

  return (
    <div className="overflow-hidden rounded-xl bg-nicchyo-base ring-1 ring-nicchyo-accent/40">
      {event.image_url && (
        <div className="relative aspect-[16/9] w-full bg-gray-100">
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover"
            sizes="(max-width: 512px) 100vw, 512px"
          />
        </div>
      )}
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-nicchyo-accent px-2 py-0.5 text-[10px] font-bold text-nicchyo-ink">
            {emoji} 今週の見どころ
          </span>
          <span className="text-[10px] text-gray-400">{label}</span>
        </div>
        <p className="mt-1.5 text-[15px] font-bold leading-snug text-nicchyo-ink">
          {event.title}
        </p>
        <EventMeta event={event} />
        {event.description && (
          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-gray-600">
            {event.description}
          </p>
        )}
      </div>
    </div>
  );
}

/** 見どころ以外の予定。写真があれば小さくサムネイルを添える（出店者インタビューの「写真が一番」に応える） */
function EventItem({ event }: { event: MarketEvent }) {
  const { label, emoji } = getCategoryPresentation(event.category);

  return (
    <li className="flex gap-2.5">
      {event.image_url ? (
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          <Image src={event.image_url} alt="" fill className="object-cover" sizes="48px" />
        </div>
      ) : (
        <span className="mt-0.5 shrink-0 text-base leading-none" aria-hidden>
          {emoji}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
            {event.image_url ? `${emoji} ${label}` : label}
          </span>
        </div>
        <p className="mt-1 text-sm font-bold leading-snug text-nicchyo-ink">{event.title}</p>
        <EventMeta event={event} />
        {event.description && (
          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-gray-600">
            {event.description}
          </p>
        )}
      </div>
    </li>
  );
}

/** 時刻・場所・連続開催の期間。すべて任意なので、無いときは行ごと出さない */
function EventMeta({ event }: { event: MarketEvent }) {
  const time = formatEventTime(event.start_time, event.end_time);
  const isContinuous = Boolean(event.end_date && event.end_date > event.event_date);
  if (!time && !event.location && !isContinuous) return null;

  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-400">
      {time && <span>{time}</span>}
      {event.location && <span>{event.location}</span>}
      {isContinuous && (
        <span className="rounded-full bg-black/5 px-1.5 py-0.5 font-semibold text-gray-500">
          {formatEventPeriod(event)}まで
        </span>
      )}
    </p>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
