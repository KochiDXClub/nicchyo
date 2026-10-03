import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { imageUploadInfo, resizeImageToBlob } from "@/lib/image/clientCompression";

/** 画面に出す写真は小さい。大きな写真を選ばれても、ここで縮めてから上げる */
export const AVATAR_IMAGE_CONFIG = { maxDimension: 256, quality: 0.85, mimeType: "image/webp" } as const;
/** 選べる写真の大きさ（縮める前）。スマホの写真でも収まる大きさ */
export const AVATAR_PICK_MAX_BYTES = 10 * 1024 * 1024;

const BUCKET = "user-avatars";

function browserSupabase(): SupabaseClient {
  return createClient() as unknown as SupabaseClient;
}

/**
 * プロフィール写真を上げ、公開 URL と保存先を返す。
 * 保存先は本人のフォルダ（{userId}/avatar-{時刻}.{拡張子}）。毎回ファイル名を変えるので、
 * ブラウザや CDN が前の写真を出し続けることがない。
 * フォルダは本人の ID でないと書けない（Storage の RLS。supabase/migrations/20261004100000）。
 *
 * ここでは前の写真を消さない。プロフィールに新しい URL を保存できてから keepOnlyAvatar で消す
 * （保存に失敗したときは、前の URL がまだ指している写真を残し、上げた新しい写真のほうを discardAvatar で消す）。
 */
export async function uploadAccountAvatar(userId: string, file: File): Promise<{ url: string; path: string }> {
  const supabase = browserSupabase();
  const blob = await resizeImageToBlob(file, AVATAR_IMAGE_CONFIG);
  const { contentType, ext } = imageUploadInfo(blob);
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType, upsert: true });
  if (error) throw error;

  return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, path };
}

/** 本人のフォルダの写真を、keepPath 以外すべて消す。keepPath を渡さなければ全部消す。失敗しても投げない */
export async function keepOnlyAvatar(userId: string, keepPath?: string): Promise<void> {
  const supabase = browserSupabase();
  try {
    const { data } = await supabase.storage.from(BUCKET).list(userId);
    const stale = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keepPath);
    if (stale.length > 0) await supabase.storage.from(BUCKET).remove(stale);
  } catch {
    // 容量が少し残るだけ
  }
}

/** 上げた写真を 1 枚消す（プロフィールに保存できなかったとき）。失敗しても投げない */
export async function discardAvatar(path: string): Promise<void> {
  try {
    await browserSupabase().storage.from(BUCKET).remove([path]);
  } catch {
    // 容量が少し残るだけ
  }
}

/** 写真をすべて消す（URL を空にする更新は、呼び出し側（updateProfile）で先に行う） */
export async function deleteAccountAvatars(userId: string): Promise<void> {
  await keepOnlyAvatar(userId);
}
