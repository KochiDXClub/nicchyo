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

export type MarketEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string; // YYYY-MM-DD
  start_time: string | null; // HH:MM:SS
  end_time: string | null;
  location: string | null;
};

export type MarketCalendar = {
  /** 直近の日曜日の開催ステータス。未登録なら null（＝通常どおり開催の想定） */
  day: MarketDay | null;
  /** 今日以降のイベント（開催日の近い順） */
  events: MarketEvent[];
};

/** 「これからの日曜市」セクションに出す既定件数 */
export const UPCOMING_EVENTS_PREVIEW_COUNT = 3;

/** カレンダーページで一度に読む上限 */
const EVENTS_LIMIT = 50;

const VALID_STATUSES: readonly string[] = ["open", "cancelled", "special", "closed"];

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

  const [dayResult, eventsResult] = await Promise.all([
    supabase
      .from("market_days")
      .select("market_date, status, note")
      .eq("market_date", sundayIso)
      .maybeSingle(),
    supabase
      .from("market_events")
      .select("id, title, description, event_date, start_time, end_time, location")
      .eq("is_published", true)
      // 当日のイベントはまだ有効なので「今日以降」で切る
      .gte("event_date", todayIso)
      .order("event_date", { ascending: true })
      .limit(options.limit ?? EVENTS_LIMIT),
  ]);

  const dayRow = dayResult.data;
  const day: MarketDay | null = dayRow
    ? {
        market_date: dayRow.market_date,
        status: normalizeStatus(dayRow.status),
        note: dayRow.note,
      }
    : null;

  return {
    day,
    events: (eventsResult.data ?? []) as MarketEvent[],
  };
}
