import { createClient } from "@/utils/supabase/client";
import { createPostImage, imageUploadInfo } from "@/lib/image/clientCompression";
import type { Post } from "../_types";
import { getNextSundayExpiry } from "@/lib/utils/date";
import { chunkArray } from "@/lib/story/reactionCounts";
import { POST_STATS_MAX_IDS, type PostStats } from "@/lib/story/postStats";

type DbContent = {
  id: string;
  vendor_id: string;
  body: string | null;
  image_url: string | null;
  expires_at: string;
  created_at: string | null;
};

function contentToPost(c: DbContent): Post {
  return {
    id: c.id,
    vendor_id: c.vendor_id,
    text: c.body ?? "",
    image_url: c.image_url ?? undefined,
    created_at: c.created_at ?? new Date().toISOString(),
    expiration_time: c.expires_at,
    status: new Date(c.expires_at) > new Date() ? "active" : "expired",
  };
}

/** ひとこと無しの投稿の title */
export const PHOTO_ONLY_TITLE = "写真だけの投稿";

export async function fetchPostById(postId: string): Promise<Post | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendor_contents")
    .select("id, vendor_id, body, image_url, expires_at, created_at")
    .eq("id", postId)
    .single();

  if (error || !data) return null;
  return contentToPost(data as DbContent);
}

export async function fetchVendorPosts(vendorId: string): Promise<Post[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendor_contents")
    .select("id, vendor_id, body, image_url, expires_at, created_at")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  const posts = data.map(contentToPost);

  // 見た人とハートの数をまとめて取得してマージする。
  // 取得に失敗しても投稿一覧自体は表示する
  try {
    const stats = await fetchPostStats(posts.map((post) => post.id));
    return posts.map((post) => ({
      ...post,
      viewCount: stats[post.id]?.views ?? 0,
      heartCount: stats[post.id]?.hearts ?? 0,
    }));
  } catch {
    return posts;
  }
}

/** 本人の近況ごとの「見た人」「ハート」の数（GET /api/vendor/posts/stats） */
async function fetchPostStats(ids: string[]): Promise<Record<string, PostStats>> {
  const merged: Record<string, PostStats> = {};
  for (const chunk of chunkArray(ids, POST_STATS_MAX_IDS)) {
    const res = await fetch(`/api/vendor/posts/stats?ids=${chunk.map(encodeURIComponent).join(",")}`);
    if (!res.ok) throw new Error("数を読み込めませんでした");
    const { stats } = (await res.json()) as { stats: Record<string, PostStats> };
    Object.assign(merged, stats);
  }
  return merged;
}

export async function createPost(
  vendorId: string,
  text: string,
  expiresAt: Date,
  imageFile?: File,
  existingImageUrl?: string
): Promise<Post> {
  // 近況フィード（/api/stories）は画像なし投稿を表示対象から除外するため、
  // 画像付き投稿のみを正式な近況投稿として認める（UI側のガードに加えた二重防御）
  if (!imageFile && !existingImageUrl) {
    throw new Error("画像を選択してください");
  }

  const supabase = createClient();
  let imageUrl: string | null = existingImageUrl ?? null;

  if (imageFile) {
    const imageBlob = await createPostImage(imageFile);
    // WebP を書き出せないブラウザでは JPEG/PNG になるので、実際の形式で保存する
    const { contentType, ext } = imageUploadInfo(imageBlob);
    const path = `${vendorId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("vendor-images")
      .upload(path, imageBlob, { contentType, upsert: false });

    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from("vendor-images")
        .getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    } else {
      console.warn("[createPost] 画像のアップロードに失敗しました:", uploadError.message);
      throw uploadError;
    }
  }

  const { data, error } = await supabase
    .from("vendor_contents")
    .insert({
      vendor_id: vendorId,
      title: postTitle(text),
      // ひとこと無しの投稿は、空文字ではなく null で持つ（読む側は body ?? "" で扱う）
      body: text || null,
      image_url: imageUrl,
      expires_at: expiresAt.toISOString(),
    })
    .select("id, vendor_id, body, image_url, expires_at, created_at")
    .single();

  if (error || !data) throw error ?? new Error("投稿の保存に失敗しました");
  return contentToPost(data as DbContent);
}

/**
 * 管理画面の一覧などで見出しに使う title。title は空にできない列なので、
 * ひとこと無しの投稿は「写真だけの投稿」と入れて、見出しが空欄にならないようにする
 */
export function postTitle(text: string): string {
  return text.trim().slice(0, 50) || PHOTO_ONLY_TITLE;
}

export async function repostContent(
  vendorId: string,
  originalPost: Post
): Promise<Post> {
  // 画像必須化前の過去投稿（画像なし）をそのまま再投稿できてしまわないようガード
  if (!originalPost.image_url) {
    throw new Error("画像のない投稿は再投稿できません。画像を追加して新規投稿してください");
  }

  const eod = getNextSundayExpiry();

  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendor_contents")
    .insert({
      vendor_id: vendorId,
      title: postTitle(originalPost.text),
      body: originalPost.text,
      image_url: originalPost.image_url ?? null,
      expires_at: eod.toISOString(),
    })
    .select("id, vendor_id, body, image_url, expires_at, created_at")
    .single();

  if (error || !data) throw error ?? new Error("再投稿に失敗しました");
  return contentToPost(data as DbContent);
}

/** 投稿の見本に出す、お店の名前と写真（近況の名札と同じもの） */
export async function fetchPostIdentity(
  vendorId: string
): Promise<{ shopName: string | null; shopImageUrl: string | null }> {
  const supabase = createClient();
  const { data } = await supabase
    .from("vendors")
    .select("shop_name, shop_image_url")
    .eq("id", vendorId)
    .maybeSingle();
  return { shopName: data?.shop_name ?? null, shopImageUrl: data?.shop_image_url ?? null };
}
