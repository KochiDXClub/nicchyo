/**
 * マップの初回案内パネル（MapIntroPanel）を見たかどうかを localStorage に記録する。
 *
 * 初来訪者にだけ「ここが何のサービスか」を一度出し、二回目以降は
 * マップへ直行させる（LP を挟まない体験を保つ）ための記録。
 *
 * プライベートブラウズや容量超過で localStorage が例外を投げることがある。
 * ここで throw するとマップページごと落ちるため、読み書きとも握りつぶし、
 * 読めないときは「まだ見ていない」に倒す（案内が余分に出るだけで済む）。
 */

export const MAP_INTRO_SEEN_KEY = "nicchyo-map-intro-seen";

export function hasSeenMapIntro(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MAP_INTRO_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markMapIntroSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MAP_INTRO_SEEN_KEY, "1");
  } catch {
    // 保存できなくても案内は閉じる。次回また出るだけ
  }
}
