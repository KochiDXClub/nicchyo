import { getNextSundayExpiry } from "@/lib/utils/date";
import type { ExpirationPreset } from "../_types";

/** 表示期間の選択肢。並びは選ばれやすい順（既定は日曜まで） */
export const EXPIRATION_OPTIONS: { preset: ExpirationPreset; label: string }[] = [
  { preset: "sunday", label: "日曜まで" },
  { preset: "1h", label: "1時間だけ" },
  { preset: "custom", label: "時間を決める" },
];

/**
 * 投稿を出しておく期限。時間を決めるのに日時が入っていない・過ぎているときは null
 * （黙って別の時刻にせず、選び直してもらう）。
 */
export function calcExpiresAt(
  preset: ExpirationPreset,
  customDateTime: string,
  now: Date = new Date()
): Date | null {
  if (preset === "1h") return new Date(now.getTime() + 60 * 60 * 1000);
  if (preset === "sunday") return getNextSundayExpiry();
  if (!customDateTime) return null;
  const at = new Date(customDateTime);
  return Number.isNaN(at.getTime()) || at <= now ? null : at;
}

/** 期限を「7/6（日）まで」「15:30まで」のように言う */
export function formatExpiresAt(preset: ExpirationPreset, expiresAt: Date, now: Date = new Date()): string {
  if (preset === "1h") return "1時間だけ";
  const m = expiresAt.getMonth() + 1;
  const d = expiresAt.getDate();
  if (preset === "sunday") return `${m}/${d}（日）まで`;
  const hm = `${expiresAt.getHours()}:${expiresAt.getMinutes().toString().padStart(2, "0")}`;
  const sameDay = expiresAt.toDateString() === now.toDateString();
  return sameDay ? `今日 ${hm}まで` : `${m}/${d} ${hm}まで`;
}

/** datetime-local の min に入れる、いまの日時（端末の時刻で） */
export function localDateTimeInputValue(at: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}
