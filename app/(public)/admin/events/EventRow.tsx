import {
  formatEventPeriod,
  formatEventTime,
  getCategoryPresentation,
  isHighlightSunday,
  normalizeCategory,
  normalizeHighlightDates,
  type MarketEvent as PublicMarketEvent,
} from "@/lib/market/calendar";
import type { MarketEvent } from "@/app/api/admin/events/route";

/** 公開側と同じ判定を使うため、管理APIの行を公開側の型に寄せる */
export function toPublicEvent(event: MarketEvent): PublicMarketEvent {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    event_date: event.event_date,
    end_date: event.end_date ?? null,
    start_time: event.start_time,
    end_time: event.end_time,
    location: event.location,
    category: normalizeCategory(event.category),
    image_url: event.image_url ?? null,
    highlight_dates: normalizeHighlightDates(event.highlight_dates),
  };
}

export function EventRow({
  event,
  sundayIso,
  deleting,
  onEdit,
  onDelete,
  onTogglePublish,
}: {
  event: MarketEvent;
  /** どの日曜の枠に出しているか。null なら表示範囲外の枠 */
  sundayIso: string | null;
  deleting: boolean;
  onEdit: (event: MarketEvent) => void;
  onDelete: (event: MarketEvent) => Promise<void>;
  onTogglePublish: (event: MarketEvent) => Promise<void>;
}) {
  const publicEvent = toPublicEvent(event);
  const { label, emoji } = getCategoryPresentation(publicEvent.category);
  const time = formatEventTime(event.start_time, event.end_time);
  const isContinuous = Boolean(event.end_date && event.end_date > event.event_date);
  // 連続開催の予定は同じ内容が複数の日曜に並ぶので、どの回を見ているか分かるようにする
  const showsRepeat = isContinuous && sundayIso !== null;
  // 見どころは週単位なので、この行がどの日曜の枠かで判定する。
  // 表示範囲外（sundayIso===null）のときは「どこかの週で見どころか」で代用する
  const isHighlightHere =
    sundayIso !== null
      ? isHighlightSunday(publicEvent, sundayIso)
      : publicEvent.highlight_dates.length > 0;

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              event.is_published ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
            }`}
          >
            {event.is_published ? "公開中" : "非公開"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            {emoji} {label}
          </span>
          {isHighlightHere && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              ★ 見どころ
            </span>
          )}
          {showsRepeat && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
              連続 {formatEventPeriod(publicEvent)}
            </span>
          )}
          {sundayIso === null && (
            <span className="text-xs text-slate-400">{formatEventPeriod(publicEvent)}</span>
          )}
        </div>
        <p className="mt-1 font-semibold text-slate-900">{event.title}</p>
        {(time ?? event.location) && (
          <p className="mt-0.5 text-xs text-slate-500">
            {time}
            {time && event.location ? " · " : ""}
            {event.location}
          </p>
        )}
        {event.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{event.description}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        <button
          type="button"
          onClick={() => void onTogglePublish(event)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            event.is_published
              ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
              : "bg-green-100 text-green-800 hover:bg-green-200"
          }`}
        >
          {event.is_published ? "非公開にする" : "公開する"}
        </button>
        <button
          type="button"
          onClick={() => onEdit(event)}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
        >
          編集
        </button>
        <button
          type="button"
          onClick={() => void onDelete(event)}
          disabled={deleting}
          className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
        >
          削除
        </button>
      </div>
    </div>
  );
}
