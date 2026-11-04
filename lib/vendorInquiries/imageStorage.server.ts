import type { SupabaseClient } from "@supabase/supabase-js";
import { INQUIRY_IMAGE_BUCKET, inquiryImagePath } from "./imageStorage";

/** 呼び出し側がスレッドの閲覧権限を確認した後だけ使う。旧公開URLは返さない。 */
export async function withSignedInquiryImage<T extends { image_url: string | null; vendor_id: string | null }>(
  client: SupabaseClient, inquiry: T,
): Promise<T> {
  const path = inquiryImagePath(inquiry.image_url, inquiry.vendor_id);
  if (!path) return { ...inquiry, image_url: null };
  const { data, error } = await client.storage.from(INQUIRY_IMAGE_BUCKET).createSignedUrl(path, 300);
  return { ...inquiry, image_url: error ? null : data?.signedUrl ?? null };
}
