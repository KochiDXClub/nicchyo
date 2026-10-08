/**
 * 触覚フィードバック（対応端末のみ）。
 *
 * 段に吸い付いた・つまんだ・停留点を通り過ぎた、といった手応えを短い振動で添える。
 * Android の Chrome などでは効き、iOS の Safari は Vibration API を持たないので黙って何もしない。
 * ユーザー操作の中から呼ぶこと（操作と無関係な振動はブラウザに無視される）。
 */
export function vibrate(pattern: number | number[]): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    // 対応していない端末や、許可されない文脈では何もしない
    return false;
  }
}
