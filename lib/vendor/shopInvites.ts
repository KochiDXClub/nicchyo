// 招待リンクの入力の形（API と画面で共通）。トークンの生成・ハッシュは shopInvites.server.ts。

import { z } from "zod";
import { parseShopPermissions, SHOP_INVITE_RULES, type ShopPermission } from "./shopPermissions";

export const CreateInviteSchema = z.object({
  /** 1 本のリンクで入れる人数 */
  maxUses: z.number().int().min(SHOP_INVITE_RULES.minUses).max(SHOP_INVITE_RULES.maxUses),
  /** 入った人に付ける権限（知らないキーは無視し、空でもよい＝見るだけのメンバー） */
  permissions: z.array(z.string()).max(20),
});

export type CreateInviteInput = { maxUses: number; permissions: ShopPermission[] };

export function parseCreateInvite(value: unknown): CreateInviteInput | null {
  const parsed = CreateInviteSchema.safeParse(value);
  if (!parsed.success) return null;
  return { maxUses: parsed.data.maxUses, permissions: parseShopPermissions(parsed.data.permissions) ?? [] };
}

/** 招待リンクのトークン（URL の末尾）の形。ここで形を確かめてから DB に問い合わせる */
export const InviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,100}$/);

export function inviteExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + SHOP_INVITE_RULES.expiresInDays * 24 * 60 * 60 * 1000);
}

export type InviteStatus = "ok" | "invalid" | "expired" | "full" | "already_member";

/** 画面に出す文言。「見つからない」と「取り消し」は区別せず、リンクの存在を探られないようにする */
export const INVITE_STATUS_MESSAGE: Record<Exclude<InviteStatus, "ok">, string> = {
  invalid: "この招待リンクは使えません。代表者に新しいリンクをもらってください。",
  expired: "この招待リンクは期限が切れています。代表者に新しいリンクをもらってください。",
  full: "この招待リンクは、入れる人数に達しました。代表者に新しいリンクをもらってください。",
  already_member: "すでに、お店に参加しています。",
};
