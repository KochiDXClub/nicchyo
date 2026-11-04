import type { SupabaseClient } from "@supabase/supabase-js";
import { INQUIRY_IMAGE_BUCKET, inquiryImagePath } from "./imageStorage";

/** 呼び出し側がスレッドの閲覧権限を確認した後だけ使う。旧公開URLは返さない。 */
export async function withSignedInquiryImage<T extends { image_url: string | null; vendor_id: string | null }>(
  client: SupabaseClient, inquiry: T,
): Promise<T> {
  const path = inquiryImagePath(inquiry.image_url, inquiry.vendor_id);
  if (!path) return { ...inquiry, image_url: null };
  try {
    const { data, error } = await client.storage.from(INQUIRY_IMAGE_BUCKET).createSignedUrl(path, 300);
    if (!error && data?.signedUrl) return { ...inquiry, image_url: data.signedUrl };
  } catch { /* 通信障害も公開URLへ戻さない */ }
  // Storageのメッセージにパスやトークンが含まれ得るので、固定の診断イベントだけを記録する。
  console.warn("[inquiry-image] signing failed");
  return { ...inquiry, image_url: null };
}
