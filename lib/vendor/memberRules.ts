// メンバー管理の「誰が誰に何をしてよいか」の規則。API が使い、画面もボタンの出し分けに同じ関数を使う。
//
// 考え方:
//   - 代表者(owner)は店舗に 1 人で、全部できる。代表者の権限・存在は、権限の付け外しや削除では動かせない
//     （代わりに「引き継ぎ」を使う）
//   - 副代表（members_manage を持つメンバー）は「管理者一歩手前」。招待・権限の変更・メンバーの削除ができる。
//     ただし権限が連鎖して広がらないよう、次の 3 つは代表者だけにする
//       1. members_manage を人に付ける・外す
//       2. members_manage を持つ人の権限を変える・外す
//       3. 自分が持っていない権限を人に付ける
//   - 自分自身の権限は自分では変えられない（自分を副代表に昇格する、を防ぐ）。抜けるときは「店舗を抜ける」を使う

import type { ShopMemberRole, ShopMembership, ShopPermission } from "./shopPermissions";

export type MemberRef = {
  userId: string;
  role: ShopMemberRole;
  permissions: readonly ShopPermission[];
};

function holdsMembersManage(member: Pick<ShopMembership, "role" | "permissions">): boolean {
  return member.role === "owner" || member.permissions.includes("members_manage");
}

/** 人（招待リンクの発行や権限の変更）に付けようとしている権限を、操作する人が付けてよいか */
export function canGrantPermissions(actor: ShopMembership, wanted: readonly ShopPermission[]): boolean {
  if (actor.role === "owner") return true;
  if (!actor.permissions.includes("members_manage")) return false;
  return wanted.every((permission) => permission !== "members_manage" && actor.permissions.includes(permission));
}

/** 相手メンバーの権限を変える・店舗から外してよいか */
export function canManageMember(actor: MemberRef, target: MemberRef): boolean {
  if (target.role === "owner") return false;
  if (target.userId === actor.userId) return false;
  if (actor.role === "owner") return true;
  if (!actor.permissions.includes("members_manage")) return false;
  // 副代表どうしは代表者だけが動かせる
  return !holdsMembersManage(target);
}

/** 代表者の引き継ぎ。代表者だけが、同じ店舗のメンバーに対してできる */
export function canTransferOwnership(actor: MemberRef, target: MemberRef): boolean {
  return actor.role === "owner" && target.role === "member" && target.userId !== actor.userId;
}

/** 店舗を自分から抜けてよいか。代表者は先に引き継ぎが要る */
export function canLeaveShop(actor: Pick<MemberRef, "role">): boolean {
  return actor.role !== "owner";
}
