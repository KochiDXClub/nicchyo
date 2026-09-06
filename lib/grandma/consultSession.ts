/**
 * 相談セッション（現地向け）
 *
 * 日曜市の現地での相談は、ほぼ全部が独立した1往復で終わる。
 * 「混んでる時間は？」の次は「トイレどこ？」で、文脈が積み上がっていかない。
 * そのため画面には常に「今の答え」1枚だけを出し、過去は畳んで持つ。
 *
 * ただし畳むのは表示だけで、API へ送る履歴は保持する。
 * 「じゃあその近くは？」のような続きの質問は、候補ボタン経由で成立させる。
 */

import type { ConsultHistoryEntry } from "@/app/(public)/consult/types/consultConversation";

export interface ConsultEntry {
  id: string;
  question: string;
  answer: string;
  speakerName?: string;
  shopIds?: number[];
  followUpQuestion?: string;
}

export interface ConsultSession {
  /** この相談がどの日のものか（YYYY-MM-DD）。日曜市はその日で完結する */
  dateKey: string;
  /** 新しいものが先頭 */
  entries: ConsultEntry[];
}

/** API へ渡す履歴の往復数。現地の質問は短いので、遡りすぎても効かない */
const HISTORY_TURN_LIMIT = 4;

export function toDateKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createEmptySession(now: Date = new Date()): ConsultSession {
  return { dateKey: toDateKey(now), entries: [] };
}

/**
 * localStorage の中身からセッションを復元する。
 *
 * 日付が変わっていたら空のセッションを返す。毎回まっさらから始まったほうが
 * 現地では迷いが少ないため（前の日曜市の相談が残っていても役に立たない）。
 */
export function restoreSession(raw: string | null, now: Date = new Date()): ConsultSession {
  if (!raw) return createEmptySession(now);
  try {
    const parsed = JSON.parse(raw) as Partial<ConsultSession> | null;
    if (!parsed || typeof parsed !== "object") return createEmptySession(now);
    if (parsed.dateKey !== toDateKey(now)) return createEmptySession(now);
    if (!Array.isArray(parsed.entries)) return createEmptySession(now);
    const entries = parsed.entries.filter(
      (entry): entry is ConsultEntry =>
        !!entry && typeof entry.id === "string" && typeof entry.question === "string"
    );
    return { dateKey: parsed.dateKey, entries };
  } catch {
    return createEmptySession(now);
  }
}

/**
 * 画面から消えても文脈は失わないよう、API へ渡す履歴を組み立てる。
 * 新しい順に持っているので、送るときは古い順へ戻す。
 */
export function buildHistoryForRequest(
  entries: ConsultEntry[],
  limit: number = HISTORY_TURN_LIMIT
): ConsultHistoryEntry[] {
  return entries
    .slice(0, limit)
    .reverse()
    .flatMap((entry) => [
      { role: "user" as const, text: entry.question },
      {
        role: "assistant" as const,
        text: entry.answer,
        speakerName: entry.speakerName ?? null,
      },
    ]);
}

export interface PickSuggestionsInput {
  entries: ConsultEntry[];
  pool: readonly string[];
  count?: number;
}

/**
 * 次に出す候補質問を選ぶ。
 *
 * - 直前の答えに紐づく続きの質問（followUpQuestion）があれば必ず先頭に置く。
 *   これが文脈会話の導線になる（利用者は文脈を意識しなくてよい）。
 * - すでに聞いた質問は出さない。
 * - 残りは相談回数で回して選ぶ。乱数を使わないのは、再レンダリングのたびに
 *   ボタンの中身が入れ替わると押し間違いのもとになるため。
 */
export function pickSuggestions({ entries, pool, count = 3 }: PickSuggestionsInput): string[] {
  const asked = new Set(entries.map((entry) => entry.question));
  const followUp = entries[0]?.followUpQuestion?.trim();

  const picked: string[] = [];
  if (followUp && !asked.has(followUp)) picked.push(followUp);

  const rest = pool.filter((question) => !asked.has(question) && !picked.includes(question));
  if (rest.length === 0) return picked.slice(0, count);

  const offset = entries.length % rest.length;
  for (let i = 0; picked.length < count && i < rest.length; i += 1) {
    picked.push(rest[(offset + i) % rest.length]);
  }
  return picked.slice(0, count);
}

/**
 * マップ上の相談から「くわしく相談する」で遷移してきたときの引き継ぎ。
 *
 * マップ側（MapCharacterConsult）は発話の並びを nicchyo-consult-chat に書く。
 * こちらは1往復を1件として持つので、user → assistant の組に畳み直す。
 * 読み込めなかったら黙って諦める（引き継げなくても相談は続けられる）。
 */
export function importHandoffEntries(raw: string | null): ConsultEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    const messages = Array.isArray(parsed)
      ? parsed
      : ((parsed as { messages?: unknown })?.messages ?? []);
    if (!Array.isArray(messages)) return [];

    const entries: ConsultEntry[] = [];
    let question: string | null = null;
    messages.forEach((raw, index) => {
      const message = raw as { role?: unknown; text?: unknown };
      if (typeof message?.text !== "string" || !message.text.trim()) return;
      if (message.role === "user") {
        question = message.text;
        return;
      }
      if (message.role === "assistant" && question) {
        entries.push({ id: `handoff-${index}`, question, answer: message.text });
        question = null;
      }
    });
    // 保持は新しい順
    return entries.reverse();
  } catch {
    return [];
  }
}
