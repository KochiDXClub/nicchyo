import type { Notice } from "@/lib/vendor/notices";

/** 出店者が受け取ったお知らせ。confirmed は自分が「確認しました」を押したか */
export type VendorNotice = Notice & { confirmed: boolean };

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? fallback;
}

export async function fetchNotices(): Promise<VendorNotice[]> {
  const res = await fetch("/api/vendor/notices");
  if (!res.ok) throw new Error(await readError(res, "お知らせを読み込めませんでした"));
  const data = (await res.json()) as { notices?: VendorNotice[] };
  return data.notices ?? [];
}

export async function confirmNotice(id: string): Promise<void> {
  const res = await fetch(`/api/vendor/notices/${id}/read`, { method: "POST" });
  if (!res.ok) throw new Error(await readError(res, "うまく記録できんかった。もういっぺん押してみてや。"));
}
