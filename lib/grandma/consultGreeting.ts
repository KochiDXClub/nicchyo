/**
 * 相談ページで、にちよさんが最初に言うひとこと。
 *
 * 入りの演出（大きいにちよさんが定位置まで縮む）は、それだけだと
 * 「絵が小さくなった」以上の意味を持たない。着いたところで話しかけてくれば、
 * 縮んだ動きが「こっちに来て、目の前に座った」として読める。
 *
 * 中身はマップで使っているひとこと集（grandmaComments）から借りる。
 * 挨拶のためだけに新しい台本を増やすより、同じ人が同じ調子で喋っているほうが
 * キャラクターとして揺れない。
 *
 * 時刻の判断以外は持ち込まない純関数にしてある（乱数も外から渡す）。
 */

/** 朝の挨拶にする上限（日曜市は朝市なので、朝の時間を広めに取る） */
const MORNING_END_HOUR = 11;
/** 昼の挨拶にする上限 */
const AFTERNOON_END_HOUR = 18;

/** ひとこと集が空でも黙らないようにする */
const FALLBACK_LINE = "なんでも聞いてや。";

/** その時刻の呼びかけ */
export function pickSalutation(hour: number): string {
  if (hour < MORNING_END_HOUR) return "おはよう。";
  if (hour < AFTERNOON_END_HOUR) return "こんにちは。";
  return "こんばんは。";
}

export interface ConsultGreetingInput {
  /** 今の時刻 */
  now: Date;
  /** ひとこと集（grandmaComments の text） */
  lines: readonly string[];
  /** 0 以上 1 未満。どのひとことを引くかだけに使う */
  random: number;
}

/**
 * 「おはよう。」＋その日のひとこと、の形でつなぐ。
 *
 * 毎回同じ挨拶だと2回目から読み飛ばされるので、後半は引くたびに変える。
 */
export function buildConsultGreeting({ now, lines, random }: ConsultGreetingInput): string {
  const salutation = pickSalutation(now.getHours());
  if (lines.length === 0) return `${salutation}${FALLBACK_LINE}`;

  const index = Math.min(Math.max(Math.floor(random * lines.length), 0), lines.length - 1);
  return `${salutation}${lines[index]}`;
}
