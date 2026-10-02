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
 * プロフィール写真を上げ、公開 URL を返す。
 * 保存先は本人のフォルダ（{userId}/avatar-{時刻}.{拡張子}）。毎回ファイル名を変えるので、
 * ブラウザや CDN が前の写真を出し続けることがない。前の写真は消す（消せなくても保存は成功させる）。
 * フォルダは本人の ID でないと書けない（Storage の RLS。supabase/migrations/20261004100000）。
 */
export async function uploadAccountAvatar(userId: string, file: File): Promise<string> {
  const supabase = browserSupabase();
  const blob = await resizeImageToBlob(file, AVATAR_IMAGE_CONFIG);
  const { contentType, ext } = imageUploadInfo(blob);
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType, upsert: true });
  if (error) throw error;

  await removeOldAvatars(supabase, userId, path);

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** 本人のフォルダの写真を（keepPath 以外）消す。keepPath を渡さなければ全部消す。失敗しても投げない */
export async function removeOldAvatars(supabase: SupabaseClient, userId: string, keepPath?: string): Promise<void> {
  try {
    const { data } = await supabase.storage.from(BUCKET).list(userId);
    const stale = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keepPath);
    if (stale.length > 0) await supabase.storage.from(BUCKET).remove(stale);
  } catch {
    // 容量が少し残るだけ
  }
}

/** 写真を消す（Storage の本人のフォルダを空にする）。URL を空にする更新は、呼び出し側（updateProfile）で行う */
export async function deleteAccountAvatars(userId: string): Promise<void> {
  await removeOldAvatars(browserSupabase(), userId);
}
