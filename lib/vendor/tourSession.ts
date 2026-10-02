/**
 * 「この機能の説明は、いまのセッションで閉じた」の記録。自動で開くのを、1セッションに1回までにするために使う。
 * 「了解した」の記録（DB の vendor_tour_seen）とは別物で、タブを閉じれば消える。
 * 途中で閉じた（背景・Esc）だけの出店者に、他の画面から戻るたびに説明を出し直さない。
 * sessionStorage が使えない環境（プライベートウィンドウなど）では、何も覚えず、常に「閉じていない」とする。
 */
const PREFIX = "vendor-tour-dismissed:";

export function wasTourDismissed(key: string): boolean {
  try {
    return window.sessionStorage.getItem(PREFIX + key) === "1";
  } catch {
    return false;
  }
}

export function markToursDismissed(keys: readonly string[]): void {
  try {
    for (const key of keys) window.sessionStorage.setItem(PREFIX + key, "1");
  } catch {
    // 覚えられなくても、説明が出し直されるだけ
  }
}
