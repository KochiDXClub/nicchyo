// 店舗の QR コード（アカウントとの紐づけ）の管理画面から呼ぶ API（app/api/admin/shop-claims）。

import { apiRequest } from "@/lib/utils/apiRequest";
import type { ShopClaimState } from "@/lib/vendor/shopClaim";
import type { ShopPermission } from "@/lib/vendor/shopPermissions";

export type ShopClaimRow = {
  vendorId: string;
  shopName: string;
  state: ShopClaimState;
  memberCount: number;
};

export type IssueResult = {
  vendorId: string;
  shopName: string | null;
  status: "ok" | "no_shop" | "already_claimed" | "error";
  /** 発行できたときだけ。この応答でしか見られない */
  url?: string;
};

export async function fetchShopClaims(): Promise<ShopClaimRow[]> {
  const data = await apiRequest<{ shops: ShopClaimRow[] }>("/api/admin/shop-claims", {}, "店舗の一覧を読み込めませんでした");
  return data.shops;
}

export async function issueClaims(vendorIds: string[]): Promise<IssueResult[]> {
  const data = await apiRequest<{ results: IssueResult[] }>(
    "/api/admin/shop-claims",
    { method: "POST", body: { action: "issue", vendorIds } },
    "QRコードを発行できませんでした",
  );
  return data.results;
}

export async function unlinkShop(vendorId: string): Promise<{ removedMembers: number }> {
  return apiRequest("/api/admin/shop-claims", { method: "POST", body: { action: "unlink", vendorId, confirm: true } }, "解除できませんでした");
}

export type AdminActivityLog = { id: number; actorName: string; label: string; summary: string; createdAt: string };

export async function fetchShopActivityLogs(vendorId: string, before?: string): Promise<{ logs: AdminActivityLog[]; hasMore: boolean }> {
  const query = `vendorId=${encodeURIComponent(vendorId)}${before ? `&before=${encodeURIComponent(before)}` : ""}`;
  return apiRequest(`/api/admin/vendor-activity-logs?${query}`, {}, "操作ログを読み込めませんでした");
}

export type AdminInvite = {
  id: string;
  permissions: ShopPermission[];
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  createdAt: string;
  state: "active" | "expired" | "full" | "revoked";
};

export async function fetchShopInvites(vendorId: string): Promise<AdminInvite[]> {
  const data = await apiRequest<{ invites: AdminInvite[] }>(
    `/api/admin/shop-invites?vendorId=${encodeURIComponent(vendorId)}`,
    {},
    "招待リンクを読み込めませんでした",
  );
  return data.invites;
}

export function createShopInvite(
  vendorId: string,
  input: { maxUses: number; permissions: ShopPermission[] },
): Promise<{ id: string; url: string; expiresAt: string }> {
  return apiRequest("/api/admin/shop-invites", { method: "POST", body: { action: "create", vendorId, ...input } }, "招待リンクを作れませんでした");
}

export async function revokeShopInvite(vendorId: string, inviteId: string): Promise<void> {
  await apiRequest("/api/admin/shop-invites", { method: "POST", body: { action: "revoke", vendorId, inviteId } }, "招待リンクを取り消せませんでした");
}
