import type { PublicMarket } from "./publicMarkets.server";

/**
 * 公開カレンダーの共有ロジック。
 *
 * すみわけ：
 *   market_days   … その日に「開催するか」（市・日付ごとに1件）。最上部の1行バーの元データ。
 *   market_events … その日に「何があるか」（1日に複数件）。「これからの日曜市」の元データ。
 */

export type MarketDayStatus = "open" | "cancelled" | "special" | "closed";

export type MarketDay = {
  market_date: string; // YYYY-MM-DD
  status: MarketDayStatus;
  note: string | null;
};

/** カードに載せる情報の種別 */
export type MarketEventCategory = "vendor" | "event" | "season" | "notice";

export type MarketEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string; // YYYY-MM-DD（連続開催なら開始日）
  /** 連続開催の最終日。null ならその日限り */
  end_date: string | null;
  start_time: string | null; // HH:MM:SS
  end_time: string | null;
  location: string | null;
  category: MarketEventCategory;
  image_url: string | null;
  /**
   * 見どころにする日曜の日付一覧。連続開催（event_date〜end_date）のうち
   * 特定の週だけを見どころにできるよう、boolean ではなく日付の配列で持つ。
   * 単発イベントなら [event_date] の1件だけを持つのが基本形。
   */
  highlight_dates: string[];
};

export type MarketCalendar = {
  todayIso: string;
  markets: (PublicMarket & { days: MarketDay[]; events: MarketEvent[] })[];
};

/** トップでは8週、カレンダーと近況ではその一部を表示する。 */
export const PUBLIC_CALENDAR_WEEKS = { landing: 8, full: 5, preview: 2 } as const;

const VALID_STATUSES: readonly string[] = ["open", "cancelled", "special", "closed"];
const VALID_CATEGORIES: readonly string[] = ["vendor", "event", "season", "notice"];

// ── 純粋関数（テスト対象） ───────────────────────────────────────────────

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 実行環境のローカル時刻ではなく JST の暦日を UTC フィールドとして持つ Date に変換する。
 *
 * 日曜市は高知のイベントなので「今日」「今週の日曜」は常に JST で決まる必要がある。
 * Vercel の Node ランタイムは UTC で動くため、素の getDay()/getDate() を使うと
 * JST の月曜 0:00〜9:00 がまだ日曜と判定され、過ぎた週の開催ステータスが出続ける。
 */
function toJstFields(date: Date): Date {
  return new Date(date.getTime() + JST_OFFSET_MS);
}

function formatUtcFields(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Date を JST の暦日として YYYY-MM-DD に変換する。
 * toISOString() は UTC に倒れて日付がずれるため使わない。
 */
export function toIsoDate(date: Date): string {
  return formatUtcFields(toJstFields(date));
}

/**
 * 指定した曜日（0=日〜6=土）の、当日を含む次の日を JST 基準の YYYY-MM-DD で返す。
 * 市ごとの開催曜日（markets.weekday）を渡して使う。
 */
export function getUpcomingMarketDateIso(weekday: number, now: Date = new Date()): string {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw new Error(`weekday must be 0..6, got ${weekday}`);
  }
  const jst = toJstFields(now);
  const daysUntil = (weekday - jst.getUTCDay() + 7) % 7;
  jst.setUTCDate(jst.getUTCDate() + daysUntil);
  return formatUtcFields(jst);
}

/** 今週（当日を含む）の日曜日を JST 基準の YYYY-MM-DD で返す */
export function getUpcomingSundayIso(now: Date = new Date()): string {
  return getUpcomingMarketDateIso(0, now);
}

/** DB から来た status 文字列を型に落とす。想定外の値は通常開催として扱う */
export function normalizeStatus(value: unknown): MarketDayStatus {
  return typeof value === "string" && VALID_STATUSES.includes(value)
    ? (value as MarketDayStatus)
    : "open";
}

/** DB から来た category 文字列を型に落とす。想定外の値はイベント扱いにする */
export function normalizeCategory(value: unknown): MarketEventCategory {
  return typeof value === "string" && VALID_CATEGORIES.includes(value)
    ? (value as MarketEventCategory)
    : "event";
}

/** DB/APIから来た値を YYYY-MM-DD の配列に落とす。想定外の値は空配列にする */
export function normalizeHighlightDates(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
  );
}

export type CategoryPresentation = {
  label: string;
  emoji: string;
};

const CATEGORY_PRESENTATION: Record<MarketEventCategory, CategoryPresentation> = {
  season: { label: "旬", emoji: "🍊" },
  vendor: { label: "出店予定", emoji: "🏪" },
  event: { label: "イベント", emoji: "🎪" },
  notice: { label: "お知らせ", emoji: "📢" },
};

export function getCategoryPresentation(category: MarketEventCategory): CategoryPresentation {
  return CATEGORY_PRESENTATION[category];
}

export type StatusPresentation = {
  label: string;
  /** バーの見た目。中止・休市は警戒色、特別開催はアクセント色 */
  tone: "neutral" | "alert" | "highlight";
};

const STATUS_PRESENTATION: Record<MarketDayStatus, StatusPresentation> = {
  open: { label: "開催", tone: "neutral" },
  cancelled: { label: "荒天中止", tone: "alert" },
  closed: { label: "臨時休市", tone: "alert" },
  special: { label: "特別開催", tone: "highlight" },
};

export function getStatusPresentation(status: MarketDayStatus): StatusPresentation {
  return STATUS_PRESENTATION[status];
}

/**
 * マップ上にバーを出すべきか。
 * 平常どおりの「開催」までマップ最上部に常設すると検索バーを押し下げるだけのノイズになるため、
 * 例外（中止・休市・特別開催）のときだけ出す。近況ページとカレンダーページでは常に出す。
 */
export function shouldSurfaceOnMap(status: MarketDayStatus): boolean {
  return status !== "open";
}

/** 「8/17（日）」形式に整形する */
export function formatEventDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][new Date(y, m - 1, d).getDay()];
  return `${m}/${d}（${weekday}）`;
}

/** 「10:00〜15:00」形式に整形する。開始も終了も無ければ null */
export function formatEventTime(
  startTime: string | null,
  endTime: string | null
): string | null {
  const trim = (t: string | null) => (t ? t.slice(0, 5) : null);
  const start = trim(startTime);
  const end = trim(endTime);
  if (start && end) return `${start}〜${end}`;
  if (start) return `${start}〜`;
  if (end) return `〜${end}`;
  return null;
}

/** 日曜1回分のカード。予定が無い日曜も枠として残す（＝開催はする、という情報になる） */
export type MarketSunday = {
  dateIso: string;
  /** 8/16（日） */
  dateLabel: string;
  /** 今週 / 来週 / あと2週 */
  relativeLabel: string;
  isThisWeek: boolean;
  day: MarketDay | null;
  /** その日の見どころ（1件だけ）。カードの主役として大きく出す */
  highlight: MarketEvent | null;
  /** 見どころを除いた残りの予定 */
  events: MarketEvent[];
};

/** 何週先かを日本語にする */
export function getRelativeSundayLabel(weeksAhead: number): string {
  if (weeksAhead === 0) return "今週";
  if (weeksAhead === 1) return "来週";
  return `あと${weeksAhead}週`;
}

function isoToDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function addDaysToIso(iso: string, days: number): string {
  const d = isoToDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return formatUtcFields(d);
}

/** 開始時刻の早い順。時刻未設定は最後に回す */
function byStartTime(a: MarketEvent, b: MarketEvent): number {
  if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time);
  if (a.start_time) return -1;
  if (b.start_time) return 1;
  return 0;
}

/**
 * その予定が指定の日曜のカードに載るか。
 *
 * 日曜以外の日付で登録された予定はその週の日曜に寄せる。
 * end_date があれば、開始の週の日曜から終了の週の日曜までの各日曜に繰り返し載る
 * （「文旦フェア 8/16〜9/6」を1件の登録で4回分の日曜に出せるようにするため）。
 * 終了日も日曜に前方で寄せる。そうしないと「月曜〜木曜」のように期間内に
 * 日曜が1つも含まれない連続開催が、どの日曜カードにも載らず消えてしまう。
 */
export function isEventOnSunday(event: MarketEvent, sundayIso: string): boolean {
  const { first, last } = getEventSundayRange(event.event_date, event.end_date);
  return sundayIso >= first && sundayIso <= last;
}

/**
 * 予定が載る日曜の範囲（first〜last、両端を含む）を返す。
 * 開始日・終了日をそれぞれ次の日曜へ寄せる。表示・見どころの選択肢・見どころの検証は
 * すべてこの範囲を使い、判定がずれないようにする。
 * end_date が無い・開始日以前の壊れたデータは開始日の週だけにする。
 */
export function getEventSundayRange(
  eventDate: string,
  endDate: string | null
): { first: string; last: string } {
  const first = getUpcomingSundayIso(isoToDate(eventDate));
  const last = endDate && endDate > eventDate ? getUpcomingSundayIso(isoToDate(endDate)) : first;
  return { first, last };
}

/** 指定の日曜が、その予定の見どころ週として選ばれているか */
export function isHighlightSunday(event: MarketEvent, sundayIso: string): boolean {
  return event.highlight_dates.includes(sundayIso);
}

/**
 * event_date〜end_date（無ければ event_date のみ）に含まれる日曜日を列挙する。
 * 管理画面で「見どころにする週」を選ばせる際、選択肢の一覧として使う。
 */
export function listSundaysInRange(eventDate: string, endDate: string | null): string[] {
  const { first, last } = getEventSundayRange(eventDate, endDate);
  const result: string[] = [];
  for (let cursor = first; cursor <= last; cursor = addDaysToIso(cursor, 7)) {
    result.push(cursor);
  }
  return result;
}

/** 連続開催なら「8/16〜9/6」、単発なら「8/16（日）」を返す */
export function formatEventPeriod(event: MarketEvent): string {
  if (!event.end_date || event.end_date <= event.event_date) {
    return formatEventDate(event.event_date);
  }
  return `${formatEventDate(event.event_date)}〜${formatEventDate(event.end_date)}`;
}

/**
 * 予定を「次のN回分の日曜」にまとめる。
 *
 * 日曜市は毎週日曜しか開かないため、月間グリッドにすると6/7が空白になり
 * 情報密度が下がる。日曜だけを縦に並べ、その日に何があるかを1枚のカードに畳む。
 * 日曜以外の日付で登録された予定は、その週の日曜のカードに寄せる。
 */
export function groupEventsBySunday(
  events: MarketEvent[],
  days: MarketDay[],
  count: number,
  now: Date = new Date()
): MarketSunday[] {
  const firstSunday = getUpcomingSundayIso(now);
  const dayByDate = new Map(days.map((d) => [d.market_date, d]));

  return Array.from({ length: count }, (_, weeksAhead) => {
    const dateIso = addDaysToIso(firstSunday, weeksAhead * 7);
    // 連続開催の予定は複数の日曜に載るため、日曜ごとに全件を判定する
    const bucket = events.filter((event) => isEventOnSunday(event, dateIso)).sort(byStartTime);
    const highlightIndex = bucket.findIndex((e) => isHighlightSunday(e, dateIso));
    const highlight = highlightIndex >= 0 ? bucket[highlightIndex] : null;

    return {
      dateIso,
      dateLabel: formatEventDate(dateIso),
      relativeLabel: getRelativeSundayLabel(weeksAhead),
      isThisWeek: weeksAhead === 0,
      day: dayByDate.get(dateIso) ?? null,
      highlight,
      events: highlight ? bucket.filter((_, i) => i !== highlightIndex) : bucket,
    };
  });
}

export type MarketCalendarDate = MarketSunday & {
  marketId: string;
  /** 日曜市単独の場合は、従来の見出しや曜日で市を伝える。 */
  marketName?: string;
  /** 開催のない日にイベントだけを掲載する場合は null。 */
  status: MarketDayStatus | null;
};

function getRelativeDateLabel(isoDate: string, todayIso: string): string {
  const days = Math.round((isoToDate(isoDate).getTime() - isoToDate(todayIso).getTime()) / 86400000);
  return days === 0 ? "今日" : days === 1 ? "明日" : `あと${days}日`;
}

/** 市と日付の組で開催状況と予定をまとめ、日付順に並べる。 */
export function getMarketCalendarDates(
  calendar: MarketCalendar,
  weeks: number,
  { includeEventDates = true }: { includeEventDates?: boolean } = {},
): MarketCalendarDate[] {
  const { todayIso, markets } = calendar;
  if (!todayIso) return [];
  const now = isoToDate(todayIso);
  const through = addDaysToIso(todayIso, weeks * 7 - 1);
  const sundayOnly = markets.length === 1 && markets[0].slug === "nichiyo" && markets[0].weekday === 0;
  return markets.flatMap((market) => {
    const marketName = sundayOnly ? undefined : market.name;
    const firstDate = getUpcomingMarketDateIso(market.weekday, now);
    const regularDates = new Set(Array.from({ length: weeks }, (_, index) => addDaysToIso(firstDate, index * 7)));
    const legacySunday = market.slug === "nichiyo" && market.weekday === 0;
    const sundays = legacySunday
      ? groupEventsBySunday(includeEventDates ? market.events : [], market.days, weeks, now)
      : [];
    const sundayByDate = new Map(sundays.map((entry) => [entry.dateIso, entry]));
    const statuses = new Map(market.days.map((day) => [day.market_date, day]));
    const dates = sundayOnly ? regularDates : new Set([...regularDates, ...statuses.keys()]);
    if (includeEventDates && !legacySunday) {
      // 継続中の期間イベントは今日に、それ以外は登録した開始日に載せる。
      for (const event of market.events) {
        const end = event.end_date ?? event.event_date;
        if (end >= todayIso) dates.add(event.event_date < todayIso ? todayIso : event.event_date);
      }
    }
    return [...dates].filter((dateIso) => dateIso >= todayIso && dateIso <= through).map((dateIso) => {
      const day = statuses.get(dateIso) ?? null;
      const status = day?.status ?? (regularDates.has(dateIso) ? "open" : null);
      const sunday = sundayByDate.get(dateIso);
      const events = includeEventDates
        ? (sunday
          ? sunday.events
          : market.events.filter((event) => event.event_date <= dateIso && (event.end_date ?? event.event_date) >= dateIso).sort(byStartTime))
        : [];
      const highlight = includeEventDates
        ? (sunday ? sunday.highlight : events.find((event) => event.highlight_dates.includes(dateIso)) ?? null)
        : null;
      return {
        marketId: market.id,
        marketName,
        dateIso,
        dateLabel: formatEventDate(dateIso),
        relativeLabel: sundayOnly && sunday ? sunday.relativeLabel : getRelativeDateLabel(dateIso, todayIso),
        isThisWeek: sundayOnly && sunday ? sunday.isThisWeek : dateIso === todayIso,
        day,
        status,
        highlight,
        events: highlight && !sunday ? events.filter((event) => event !== highlight) : events,
      };
    });
  }).sort((a, b) => a.dateIso.localeCompare(b.dateIso));
}
