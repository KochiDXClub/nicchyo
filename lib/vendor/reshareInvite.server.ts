import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashInviteToken } from "./shopInvites.server";

// 再共有用のURLも元の招待行を参照する。人数・期限・取り消しの判定は元のリンクと共通。
export function reshareInviteToken(id: string, tokenHash: string): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("招待リンクの署名鍵が設定されていません");
  const signature = createHmac("sha256", key)
    .update(`nicchyo:shop-invite:reshare:v1:${id}:${tokenHash}`)
    .digest("base64url");
  return `r1_${id}_${signature}`;
}

export async function resolveInviteHash(db: SupabaseClient, token: string): Promise<string | null> {
  // 発行時のランダムトークンは32文字。既存の招待URLもそのまま利用できる。
  const match = /^r1_([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})_[A-Za-z0-9_-]{43}$/.exec(token);
  if (!match) return hashInviteToken(token);
  const id = match[1];
  const { data, error } = await db.from("shop_invites").select("token_hash").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const expected = reshareInviteToken(id, data.token_hash);
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token)) ? data.token_hash : null;
}
