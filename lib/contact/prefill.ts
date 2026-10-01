/**
 * 問い合わせフォーム（/contact）の本文を、別の画面から入れておく仕組み。
 *
 * URL の ?message= で渡すと、自由文がアクセス解析（page-visit）や GA4 の page_path、
 * ブラウザの履歴に残ってしまう。そのため、このタブの sessionStorage に一度だけ置き、
 * フォームが開いたときに取り出して消す。
 */

const KEY = "nicchyo:contact-prefill";
/** 置いてから使えるまでの時間。押したのに開かなかったときに、後から別の問い合わせへ紛れ込まないようにする */
const TTL_MS = 10 * 60 * 1000;
export const CONTACT_MESSAGE_MAX = 1000;

export function saveContactPrefill(message: string, now = Date.now()): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ message: message.slice(0, CONTACT_MESSAGE_MAX), savedAt: now }));
  } catch {
    // 保存できない環境（プライベートブラウズなど）では、空のフォームを開くだけにする
  }
}

/** 置いてある本文を取り出して消す。無い・古い・壊れているときは null */
export function takeContactPrefill(now = Date.now()): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw === null) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as { message?: unknown; savedAt?: unknown };
    if (typeof parsed.message !== "string" || typeof parsed.savedAt !== "number") return null;
    if (now - parsed.savedAt > TTL_MS) return null;
    return parsed.message.slice(0, CONTACT_MESSAGE_MAX) || null;
  } catch {
    return null;
  }
}
