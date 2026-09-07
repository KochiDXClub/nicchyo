/**
 * 協賛・支援いただいている企業や団体
 *
 * /support と /about の両方で同じものを出すので、データはここに置く。
 *
 * まだ1件も無いあいだも、枠そのものは出す。協賛を検討する人にとっては
 * 「お金を出すと何が得られるか」が一番の判断材料で、それを言葉で説明するより
 * 空いている枠を見てもらう方が早い。
 *
 * 架空の企業名やロゴをサンプルとして置かないこと。実在しない協賛実績に見える。
 */

export type Supporter = {
  /** 表示名。ロゴが無いときはこれを出す */
  name: string;
  /**
   * ロゴ画像のパス。public/images/supporters/ に置いて "/images/supporters/xxx.png" と書く。
   * 外部URLにすると next.config.js の remotePatterns を触ることになるので、
   * 画像は預かってリポジトリに入れる
   */
  logoUrl?: string;
  /** リンク先。無ければリンクにしない */
  url?: string;
};

export const SUPPORTERS: Supporter[] = [];

/** 空き枠をいくつ見せるか。埋まっている数と合わせて、この数まで枠を並べる */
export const SUPPORTER_SLOT_COUNT = 3;

/** 実際に並べる枠。埋まっているものが先、残りは空き枠 */
export function buildSupporterSlots(
  supporters: Supporter[] = SUPPORTERS,
  slotCount: number = SUPPORTER_SLOT_COUNT
): (Supporter | null)[] {
  const empties = Math.max(slotCount - supporters.length, 0);
  return [...supporters, ...Array.from({ length: empties }, () => null)];
}
