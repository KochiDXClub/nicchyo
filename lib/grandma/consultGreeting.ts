/**
 * 相談ページで、話し手が最初に言うひとこと。
 *
 * 開いたとき、そして話し手を選び直したときに出す。相手が黙って立っているより、
 * ひとこと言ってくれたほうが「この人に聞いていい場所だ」と早く伝わる。
 *
 * 台本は人ごとに持つ（app/(public)/consult/data/consultCharacters.ts）。
 * 口調が違う人に同じ挨拶をさせると、選び分ける意味がなくなるため。
 *
 * 時刻の判断以外は持ち込まない純関数にしてある（何番目を引くかも外から渡す）。
 */

import type { ConsultGreetingScript } from "@/app/(public)/consult/data/consultCharacters";

/** 朝の呼びかけにする上限（日曜市は朝市なので、朝を広めに取る） */
const MORNING_END_HOUR = 11;
/** 昼の呼びかけにする上限 */
const AFTERNOON_END_HOUR = 18;

/** 台本が空でも黙らないようにする */
const FALLBACK_LINE = "なんでも聞いてね。";

/** その時刻の呼びかけを、その人の言い方で返す */
export function pickSalutation(script: ConsultGreetingScript, hour: number): string {
  if (hour < MORNING_END_HOUR) return script.morning;
  if (hour < AFTERNOON_END_HOUR) return script.afternoon;
  return script.evening;
}

export interface ConsultGreetingInput {
  /** 今の時刻 */
  now: Date;
  /** 話し手の台本 */
  script: ConsultGreetingScript;
  /**
   * 何番目のひとことか。台本の長さを超えたら先頭に戻る。
   * 呼び出し側が人ごとに数えているので、行き来しても同じ台詞が続かない。
   */
  index: number;
}

/**
 * 呼びかけ＋その人のひとこと、の形でつなぐ。
 *
 * 毎回同じだと2回目から読み飛ばされるので、後半は選ばれるたびに次へ進める。
 */
export function buildConsultGreeting({ now, script, index }: ConsultGreetingInput): string {
  const salutation = pickSalutation(script, now.getHours());
  const { lines } = script;
  if (lines.length === 0) return `${salutation}${FALLBACK_LINE}`;

  // 負の値でも落ちないようにしておく（数え方を変えても壊れない）
  const position = ((Math.trunc(index) % lines.length) + lines.length) % lines.length;
  return `${salutation}${lines[position]}`;
}
