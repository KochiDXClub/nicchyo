import { createClient } from "@/utils/supabase/client";
import type { Post } from "../_types";
import { getNextSundayExpiry } from "@/lib/utils/date";
import { fetchReactionCounts } from "@/lib/story/reactions";

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

  // ハート数をバッチ取得してマージ（content_reactions は直クエリ不可のためAPI経由）。
  // 取得に失敗しても投稿一覧自体は表示する
  try {
    const { counts } = await fetchReactionCounts(posts.map((post) => post.id));
    return posts.map((post) => ({
      ...post,
      heartCount: counts[post.id] ?? 0,
    }));
  } catch {
    return posts;
  }
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
    const ext = imageFile.name.split(".").pop() ?? "jpg";
    const path = `${vendorId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("vendor-images")
      .upload(path, imageFile, { contentType: imageFile.type, upsert: false });

    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from("vendor-images")
        .getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }
  }

  const { data, error } = await supabase
    .from("vendor_contents")
    .insert({
      vendor_id: vendorId,
      title: text.slice(0, 50),
      body: text,
      image_url: imageUrl,
      expires_at: expiresAt.toISOString(),
    })
    .select("id, vendor_id, body, image_url, expires_at, created_at")
    .single();

  if (error || !data) throw error ?? new Error("投稿の保存に失敗しました");
  return contentToPost(data as DbContent);
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
      title: originalPost.text.slice(0, 50),
      body: originalPost.text,
      image_url: originalPost.image_url ?? null,
      expires_at: eod.toISOString(),
    })
    .select("id, vendor_id, body, image_url, expires_at, created_at")
    .single();

  if (error || !data) throw error ?? new Error("再投稿に失敗しました");
  return contentToPost(data as DbContent);
}
