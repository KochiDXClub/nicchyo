// キャラの話し方テストの回数制限（モック）。10分で100回まで。
// 本番ではサーバー側で同じ規則を数える。これは画面に「あと何回」を出すための写し。

export const TEST_LIMIT = 100;
export const TEST_WINDOW_MS = 10 * 60 * 1000;

export type TestUsage = {
  /** 直近の窓に入る送信時刻（ミリ秒）。古い順 */
  timestamps: readonly number[];
};

export const EMPTY_USAGE: TestUsage = { timestamps: [] };

function inWindow(usage: TestUsage, now: number): number[] {
  return usage.timestamps.filter((t) => now - t < TEST_WINDOW_MS);
}

export function remainingTests(usage: TestUsage, now: number): number {
  return Math.max(0, TEST_LIMIT - inWindow(usage, now).length);
}

/** 次に使えるようになるまでの待ち時間（使えるなら 0） */
export function msUntilNextTest(usage: TestUsage, now: number): number {
  const live = inWindow(usage, now);
  if (live.length < TEST_LIMIT) return 0;
  return live[0] + TEST_WINDOW_MS - now;
}

/** 1回ぶん使う。上限ならそのまま返す（ok: false） */
export function consumeTest(usage: TestUsage, now: number): { ok: boolean; usage: TestUsage } {
  const live = inWindow(usage, now);
  if (live.length >= TEST_LIMIT) return { ok: false, usage: { timestamps: live } };
  return { ok: true, usage: { timestamps: [...live, now] } };
}
