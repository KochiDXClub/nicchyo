import type { KeyboardEvent } from "react";

/**
 * IME（日本語入力）の変換確定として押された Enter かどうかを判定する。
 *
 * Safari は変換確定の Enter で `isComposing` が false になった状態の
 * keydown を発火する（compositionend が先に走るため）。その代わり
 * `keyCode` に IME 確定を示す 229 が残るので、両方を見て判定する。
 * これを見落とすと、Safari で変換候補を確定しただけのつもりが
 * 未確定テキストのまま送信されてしまう。
 */
export function isImeComposing(event: KeyboardEvent<HTMLElement>): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}
