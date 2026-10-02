import { requireVendorContext, type VendorContextResult } from "@/lib/vendor/shopContext.server";
import type { ShopPermission } from "@/lib/vendor/shopPermissions";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requestEmbeddings } from "@/lib/ai/openaiFetch";
import { noteEmbeddingText, type AiNoteInput } from "@/lib/vendor/aiNotes";

/** 一覧・保存の結果で返す列（ベクトルそのものは読まない） */
export const NOTE_COLUMNS =
  "id, title, content, for_visitors, for_vendor, updated_at, has_embedding:store_knowledge_searchable";

/**
 * ログイン中の出店者と、その人の権限で読み書きする Supabase クライアント。
 * store_knowledge / vendor_ai_settings / vendor_tour_seen は RLS で「その店舗のメンバーで権限がある人」に絞られているので、
 * service_role は使わない。操作する店舗は user.id ではなく vendorId（所属店舗）で指す。
 */
export async function requireVendor(permission?: ShopPermission): Promise<VendorContextResult> {
  return requireVendorContext({ permission });
}

/**
 * 書き込み（ノートの追加・書き直し・削除、設定の保存）の入口。
 * 同じオリジンからか、出店者か、書き込みの回数（ベクトル作りで OpenAI を呼ぶので出店者1人あたり）を確かめる。
 */
export async function requireVendorWrite(request: Request, permission?: ShopPermission): Promise<VendorContextResult> {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return { ok: false, response: originCheck.response };

  const auth = await requireVendor(permission);
  if (!auth.ok) return auth;

  const rateLimited = await enforceRateLimit(request, {
    bucket: "vendor-ai-notes-write",
    limit: 30,
    windowMs: 10 * 60 * 1000,
    identity: auth.user.id,
  });
  if (rateLimited) return { ok: false, response: rateLimited };
  return auth;
}

/**
 * ノートの検索用ベクトルを作る。作れなくても保存は止めない
 * （ノート自体は残り、一覧で「にちよさんがまだ探せない」と出す）。
 */
export async function embedNote(note: Pick<AiNoteInput, "title" | "content">): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await requestEmbeddings(apiKey, noteEmbeddingText(note));
    if (!res.ok) return null;
    const payload = (await res.json()) as { data?: { embedding: number[] }[] };
    return payload.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

export function toNoteRow(note: AiNoteInput) {
  return {
    title: note.title,
    content: note.content,
    for_visitors: note.forVisitors,
    for_vendor: note.forVendor,
  };
}
