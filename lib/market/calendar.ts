import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * 日曜市カレンダー（docs/discussion-market-calendar.md フェーズ1）の共有ロジック。
 *
 * すみわけ：
 *   market_days   … その日に「開催するか」（1日1件）。最上部の1行バーの元データ。
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
  is_highlight: boolean;
};

export type MarketCalendar = {
  /** 今週の日曜の開催ステータス。未登録なら null（＝通常どおり開催の想定） */
  day: MarketDay | null;
  /** 今日以降に登録されている開催ステータス（日曜ごとのカードで使う） */
  days: MarketDay[];
  /** 今日以降のイベント（開催日の近い順） */
  events: MarketEvent[];
};

/** 近況ページ下部に出す日曜の数 */
export const UPCOMING_SUNDAYS_PREVIEW_COUNT = 2;

/** カレンダーページに出す日曜の数 */
export const UPCOMING_SUNDAYS_FULL_COUNT = 5;

/** カレンダーページで一度に読む上限 */
const EVENTS_LIMIT = 50;

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

/** 今週（当日を含む）の日曜日を JST 基準の YYYY-MM-DD で返す */
export function getUpcomingSundayIso(now: Date = new Date()): string {
  const jst = toJstFields(now);
  const daysUntilSunday = jst.getUTCDay() === 0 ? 0 : 7 - jst.getUTCDay();
  jst.setUTCDate(jst.getUTCDate() + daysUntilSunday);
  return formatUtcFields(jst);
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

function addDaysToIso(iso: string, days: number): string {
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
 * end_date があれば、開始の週の日曜から end_date までの各日曜に繰り返し載る
 * （「文旦フェア 8/16〜9/6」を1件の登録で4回分の日曜に出せるようにするため）。
 */
export function isEventOnSunday(event: MarketEvent, sundayIso: string): boolean {
  const startSunday = getUpcomingSundayIso(isoToDate(event.event_date));
  if (sundayIso < startSunday) return false;
  if (!event.end_date || event.end_date < event.event_date) return sundayIso === startSunday;
  return sundayIso <= event.end_date;
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
    const highlightIndex = bucket.findIndex((e) => e.is_highlight);
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

// ── DB アクセス ─────────────────────────────────────────────────────────

type Client = SupabaseClient<Database>;

/**
 * 公開カレンダー（開催ステータス＋今日以降のイベント）を取得する。
 * anon キーのクライアントで呼ぶ前提で、RLS の公開ポリシーに従う。
 */
export async function fetchMarketCalendar(
  supabase: Client,
  options: { limit?: number; now?: Date } = {}
): Promise<MarketCalendar> {
  const now = options.now ?? new Date();
  const todayIso = toIsoDate(now);
  const sundayIso = getUpcomingSundayIso(now);

  const [daysResult, eventsResult] = await Promise.all([
    supabase
      .from("market_days")
      .select("market_date, status, note")
      // 今週の日曜から先。日曜ごとのカードそれぞれにステータスを出せるようにまとめて読む
      .gte("market_date", sundayIso)
      .order("market_date", { ascending: true })
      .limit(12),
    supabase
      .from("market_events")
      .select(
        "id, title, description, event_date, end_date, start_time, end_time, location, category, image_url, is_highlight"
      )
      .eq("is_published", true)
      // 「今日以降に掛かっている予定」を引く。連続開催は開始日が過去でも
      // 終了日が未来なら残す（期間の途中で一覧から消えないようにする）。
      // 当日のイベントはまだ有効なので今日を含める。
      .or(`end_date.gte.${todayIso},and(end_date.is.null,event_date.gte.${todayIso})`)
      .order("event_date", { ascending: true })
      .limit(options.limit ?? EVENTS_LIMIT),
  ]);

  const days: MarketDay[] = (daysResult.data ?? []).map((row) => ({
    market_date: row.market_date,
    status: normalizeStatus(row.status),
    note: row.note,
  }));

  const events: MarketEvent[] = (eventsResult.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    event_date: row.event_date,
    end_date: row.end_date,
    start_time: row.start_time,
    end_time: row.end_time,
    location: row.location,
    category: normalizeCategory(row.category),
    image_url: row.image_url,
    is_highlight: row.is_highlight,
  }));

  return {
    day: days.find((d) => d.market_date === sundayIso) ?? null,
    days,
    events,
  };
}
