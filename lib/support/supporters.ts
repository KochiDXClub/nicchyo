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
  /**
   * 年額。入れると掲載枠の下に、色の印と金額が出る。
   * 金額を出したくない協賛には入れない。相手に確認してから入れること
   */
  amountJpy?: number;
};

export const SUPPORTERS: Supporter[] = [];

/**
 * 空き枠をいくつ見せるか。埋まっている数と合わせて、この数まで枠を並べる。
 *
 * 募集している口数と一致させること。枠の数がそのまま「あと何社ぶん空いているか」に
 * なるので、口数と食い違うと図が嘘をつく。
 * SUPPORTER_COLORS の色数を超える数にもしないこと（超えたぶんは灰色にまとめられる）。
 */
export const SUPPORTER_SLOT_COUNT = 4;

/**
 * 協賛ごとの色。並び順は固定で、増えても使い回さない。
 * クリーム地（#FFFAF0）に対して、明度帯・彩度・隣り合う色の判別・コントラストを
 * 検証済み。色覚特性での隣接差が下限帯に入るため、色だけに頼らず必ず
 * 名前と金額を並べて出すこと。
 */
export const SUPPORTER_COLORS = ["#D97706", "#15803D", "#0369A1", "#7C3AED"] as const;

/**
 * 色枠を使い切ったぶんのまとめ先。
 * identity ではなくまとめ先なので、彩度を持たない中立色にする。
 */
export const OTHER_FUNDING_COLOR = "#8A8177";

/** 掲載枠に添える色。金額を出していない協賛には色を付けない */
export function assignSupporterColors(supporters: Supporter[]): (string | null)[] {
  let slot = 0;
  return supporters.map((supporter) => {
    if (supporter.amountJpy === undefined) return null;
    const color = SUPPORTER_COLORS[slot] ?? OTHER_FUNDING_COLOR;
    slot += 1;
    return color;
  });
}

/** 実際に並べる枠。埋まっているものが先、残りは空き枠 */
export function buildSupporterSlots(
  supporters: Supporter[] = SUPPORTERS,
  slotCount: number = SUPPORTER_SLOT_COUNT
): (Supporter | null)[] {
  const empties = Math.max(slotCount - supporters.length, 0);
  return [...supporters, ...Array.from({ length: empties }, () => null)];
}
