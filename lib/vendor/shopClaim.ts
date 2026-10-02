// QR＋トークンでの店舗紐づけの、入力の形と画面に出す文言（API と画面で共通）。
// トークンの生成・ハッシュは招待リンクと同じ shopInvites.server.ts を使う。

import { z } from "zod";
import { InviteTokenSchema } from "./shopInvites";

export const ClaimTokenSchema = InviteTokenSchema;

/** 運営が 1 回で QR を発行できる店舗の数（日曜市の出店者数の上限に合わせる） */
export const CLAIM_BULK_MAX = 300;

export const IssueClaimSchema = z.object({
  action: z.literal("issue"),
  vendorIds: z.array(z.string().uuid()).min(1).max(CLAIM_BULK_MAX),
});

export const UnlinkClaimSchema = z.object({
  action: z.literal("unlink"),
  vendorId: z.string().uuid(),
  /** 画面で「メンバー全員が外れます」を確かめた印。無ければ実行しない */
  confirm: z.literal(true),
});

export const ClaimActionSchema = z.discriminatedUnion("action", [IssueClaimSchema, UnlinkClaimSchema]);

export type ClaimStatus = "ok" | "invalid" | "already_claimed" | "already_member";

/** 「無い」「取り消し済み」「使用済み」は区別しない（QR の存在を探られないように） */
export const CLAIM_STATUS_MESSAGE: Record<Exclude<ClaimStatus, "ok">, string> = {
  invalid: "このQRコードは使えません。運営に新しいQRコードをもらってください。",
  already_claimed: "このお店には、すでに代表者が登録されています。運営に相談してください。",
  already_member: "すでに、別のお店に参加しています。",
};

/** 運営の画面に出す、店舗ごとの紐づけの状態 */
export type ShopClaimState = "claimed" | "unclaimed" | "qr_issued";
