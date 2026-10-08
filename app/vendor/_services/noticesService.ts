import type { Notice } from "@/lib/vendor/notices";

/** 出店者が受け取ったお知らせ。confirmed は自分が「確認しました」を押したか */
export type VendorNotice = Notice & { confirmed: boolean };

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? fallback;
}

export type VendorNotices = {
  notices: VendorNotice[];
  /** 出店者のアカウントができた日時 */
  joinedAt: string | null;
};

export async function fetchNotices(): Promise<VendorNotices> {
  const res = await fetch("/api/vendor/notices");
  if (!res.ok) throw new Error(await readError(res, "お知らせを読み込めませんでした"));
  const data = (await res.json()) as { notices?: VendorNotice[]; joinedAt?: string };
  return { notices: data.notices ?? [], joinedAt: data.joinedAt ?? null };
}

/** 出店者ページの帯で知らせる期間。過ぎたお知らせは連絡ページでだけ見られる */
export const NOTICE_BANNER_DAYS = 30;

/**
 * 出店者ページの帯に出す、まだ確認していないお知らせ。
 * 古いもの（開催日の過ぎた知らせなど）と、アカウントを作る前に出たものは出さない。
 */
export function noticesForBanner({ notices, joinedAt }: VendorNotices, now = Date.now()): VendorNotice[] {
  const since = Math.max(now - NOTICE_BANNER_DAYS * 24 * 60 * 60 * 1000, joinedAt ? Date.parse(joinedAt) || 0 : 0);
  return notices.filter((n) => !n.confirmed && Date.parse(n.createdAt) >= since);
}

export async function confirmNotice(id: string): Promise<void> {
  const res = await fetch(`/api/vendor/notices/${id}/read`, { method: "POST" });
  if (!res.ok) throw new Error(await readError(res, "うまく記録できんかった。もういっぺん押してみてや。"));
}
