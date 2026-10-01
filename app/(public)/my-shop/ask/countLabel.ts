/**
 * 質問の数の数え方。「つ」は9までしか自然に使えないので、10からは「こ」にする
 * （新しい出店者だと、はじめは10を超えることがある）
 */
export function countUnit(count: number): string {
  return count < 10 ? "つ" : "こ";
}

export function countLabel(count: number): string {
  return `${count}${countUnit(count)}`;
}
