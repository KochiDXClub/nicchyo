import { createClient } from "@/utils/supabase/client";
import type {
  VendorInquiryCategory,
  VendorInquiryTopic,
  VendorInquiryUrgency,
  VendorInquiryReplySenderRole,
} from "@/lib/vendorInquiries/constants";

export type VendorInquiry = {
  id: string;
  vendor_id: string | null;
  topic: VendorInquiryTopic;
  category: VendorInquiryCategory;
  urgency: VendorInquiryUrgency;
  body: string;
  image_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type VendorInquiryReply = {
  id: string;
  inquiry_id: string;
  sender_role: VendorInquiryReplySenderRole;
  sender_id: string | null;
  body: string;
  created_at: string;
};

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? fallback;
}

export async function fetchMyInquiries(): Promise<VendorInquiry[]> {
  const res = await fetch("/api/vendor/inquiries");
  if (!res.ok) throw new Error(await readError(res, "連絡の一覧を取得できませんでした"));
  const data = (await res.json()) as { inquiries: VendorInquiry[] };
  return data.inquiries ?? [];
}

export async function fetchInquiryDetail(
  id: string
): Promise<{ inquiry: VendorInquiry; replies: VendorInquiryReply[] }> {
  const res = await fetch(`/api/vendor/inquiries/${id}`);
  if (!res.ok) throw new Error(await readError(res, "連絡の内容を取得できませんでした"));
  const data = (await res.json()) as { inquiry: VendorInquiry; replies: VendorInquiryReply[] };
  return { inquiry: data.inquiry, replies: data.replies ?? [] };
}

/**
 * 添付画像を vendor-images バケットへ上げ、公開URLを返す。
 * postsService.savePost と同じ置き場・命名にそろえている。
 * 返すURLは https://<project>.supabase.co/... の形になり、
 * API側の isAllowedVendorInquiryImageUrl の許可条件を満たす。
 */
export async function uploadInquiryImage(vendorId: string, file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${vendorId}/inquiries/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("vendor-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("画像をアップロードできませんでした");

  const { data } = supabase.storage.from("vendor-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function createInquiry(input: {
  topic: VendorInquiryTopic;
  category: VendorInquiryCategory;
  urgency: VendorInquiryUrgency;
  body: string;
  imageUrl?: string;
}): Promise<VendorInquiry> {
  const res = await fetch("/api/vendor/inquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: input.topic,
      category: input.category,
      urgency: input.urgency,
      body: input.body,
      ...(input.imageUrl ? { image_url: input.imageUrl } : {}),
    }),
  });
  if (!res.ok) throw new Error(await readError(res, "送信できませんでした"));
  const data = (await res.json()) as { inquiry: VendorInquiry };
  return data.inquiry;
}

export async function replyToInquiry(id: string, body: string): Promise<VendorInquiryReply> {
  const res = await fetch(`/api/vendor/inquiries/${id}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(await readError(res, "返信できませんでした"));
  const data = (await res.json()) as { reply: VendorInquiryReply };
  return data.reply;
}
