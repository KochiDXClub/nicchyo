// メンバー管理・招待・引き継ぎ・操作ログの API 呼び出し（app/api/vendor/{members,invites,owner,activity-logs}）。
// 権限の規則は API 側が決める。ここは通信と型だけを持つ。

import { apiRequest } from "@/lib/utils/apiRequest";
import type { ShopMemberRole, ShopPermission } from "@/lib/vendor/shopPermissions";

export type ShopMemberView = {
  userId: string;
  name: string;
  /** メンバーの管理ができる人にだけ返ってくる */
  email: string | null;
  role: ShopMemberRole;
  permissions: ShopPermission[];
  joinedAt: string;
  isMe: boolean;
};

export type MembersResponse = {
  members: ShopMemberView[];
  me: { role: ShopMemberRole; permissions: ShopPermission[] };
};

export type InviteState = "active" | "expired" | "full" | "revoked";

export type InviteView = {
  id: string;
  permissions: ShopPermission[];
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  createdAt: string;
  state: InviteState;
};

export type ActivityLogView = {
  id: number;
  actorName: string;
  action: string;
  label: string;
  summary: string;
  createdAt: string;
};

export function fetchMembers(): Promise<MembersResponse> {
  return apiRequest<MembersResponse>("/api/vendor/members", {}, "メンバーを読み込めませんでした");
}

export async function updateMemberPermissions(userId: string, permissions: ShopPermission[]): Promise<void> {
  await apiRequest(`/api/vendor/members/${userId}`, { method: "PATCH", body: { permissions } }, "権限を保存できませんでした");
}

export async function removeMember(userId: string): Promise<void> {
  await apiRequest(`/api/vendor/members/${userId}`, { method: "DELETE" }, "メンバーを外せませんでした");
}

export async function leaveShop(): Promise<void> {
  await apiRequest("/api/vendor/members/leave", { method: "POST" }, "店舗を抜けられませんでした");
}

export async function transferOwnership(toUserId: string): Promise<void> {
  await apiRequest("/api/vendor/owner/transfer", { method: "POST", body: { toUserId } }, "代表者を引き継げませんでした");
}

export async function fetchInvites(): Promise<InviteView[]> {
  const data = await apiRequest<{ invites: InviteView[] }>("/api/vendor/invites", {}, "招待リンクを読み込めませんでした");
  return data.invites;
}

export function createInvite(input: { maxUses: number; permissions: ShopPermission[] }): Promise<{ id: string; url: string; expiresAt: string }> {
  return apiRequest("/api/vendor/invites", { method: "POST", body: input }, "招待リンクを作れませんでした");
}

export async function revokeInvite(id: string): Promise<void> {
  await apiRequest(`/api/vendor/invites/${id}`, { method: "DELETE" }, "招待リンクを取り消せませんでした");
}

export async function fetchActivityLogs(before?: string): Promise<{ logs: ActivityLogView[]; hasMore: boolean }> {
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  return apiRequest(`/api/vendor/activity-logs${query}`, {}, "操作ログを読み込めませんでした");
}
