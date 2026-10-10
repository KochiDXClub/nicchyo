import { createClient } from "@/utils/supabase/client";
import { createPostImage, imageUploadInfo } from "@/lib/image/clientCompression";
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

/** APIが返したHTTPステータスを持つエラー。401のときにログインへの導線を出すために使う */
export class VendorInquiryRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "VendorInquiryRequestError";
    this.status = status;
  }
}

/** ログインの有効期限が切れている（401）か。ログインへの導線を出すかの判断に使う */
export function needsLogin(error: unknown): boolean {
  return error instanceof VendorInquiryRequestError && error.status === 401;
}

/**
 * ステータスごとの日本語の文言。
 * API は 401 で "Unauthorized"、404 で "Not found"、429 で "Too Many Requests" と
 * 英語を返すため（requireVendorContext / rateLimit）、そのまま画面に出さない。
 */
const STATUS_MESSAGES: Record<number, string> = {
  401: "ログインの有効期限が切れたようです。もう一度ログインしてください。",
  403: "この操作をする権限がありません。",
  404: "この連絡は見つかりませんでした。",
  429: "送信が続いています。しばらく待ってからもう一度お試しください。",
  500: "うまく処理できませんでした。しばらくしてからお試しください。",
  503: "一時的に読み込めませんでした。もう一度お試しください。",
};

/** ASCII以外の文字を含むか。APIが日本語の文言を返している場合は、そちらの方が具体的なので尊重する */
function hasJapanese(text: string): boolean {
  return /[^\x00-\x7F]/.test(text);
}

async function readError(res: Response, fallback: string): Promise<VendorInquiryRequestError> {
  const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
  const message = (() => {
    // レート制限は message に日本語の説明（待ち時間の案内）を入れているので優先する
    if (res.status === 429) return data?.message ?? STATUS_MESSAGES[429];
    // 400のバリデーション（zod）や403は日本語の error を返すので、それを活かす
    if (data?.error && hasJapanese(data.error)) return data.error;
    return STATUS_MESSAGES[res.status] ?? fallback;
  })();
  return new VendorInquiryRequestError(message, res.status);
}

export async function fetchMyInquiries(): Promise<VendorInquiry[]> {
  const res = await fetch("/api/vendor/inquiries");
  if (!res.ok) throw await readError(res, "連絡の一覧を取得できませんでした");
  const data = (await res.json()) as { inquiries: VendorInquiry[] };
  return data.inquiries ?? [];
}

export async function fetchInquiryDetail(
  id: string
): Promise<{ inquiry: VendorInquiry; replies: VendorInquiryReply[] }> {
  const res = await fetch(`/api/vendor/inquiries/${id}`);
  if (!res.ok) throw await readError(res, "連絡の内容を取得できませんでした");
  const data = (await res.json()) as { inquiry: VendorInquiry; replies: VendorInquiryReply[] };
  return { inquiry: data.inquiry, replies: data.replies ?? [] };
}

/**
 * 添付画像を vendor-images バケットへ上げ、公開URLを返す。
 * postsService.savePost と同じ置き場・命名・変換処理にそろえている。
 * 返すURLは https://<project>.supabase.co/... の形になり、
 * API側の isAllowedVendorInquiryImageUrl の許可条件を満たす。
 *
 * 近況投稿と同じく createPostImage で WebP に縮小してから上げる。
 * バケットは jpeg/png/webp/gif かつ5MBまでなので、スマホの原寸写真（3MB〜10MB）や
 * iPhone の HEIC をそのまま上げると弾かれるため、ここで形式と容量をそろえる。
 */
export async function uploadInquiryImage(
  vendorId: string,
  file: File
): Promise<{ path: string; url: string }> {
  const supabase = createClient();
  const blob = await createPostImage(file);
  // WebP を書き出せないブラウザでは JPEG/PNG になるので、実際の形式で保存する
  const { contentType, ext } = imageUploadInfo(blob);
  const path = `${vendorId}/inquiries/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("vendor-images")
    .upload(path, blob, { contentType, upsert: false });
  if (error) throw new Error("画像をアップロードできませんでした");

  const { data } = supabase.storage.from("vendor-images").getPublicUrl(path);
  return { path, url: data.publicUrl };
}

/**
 * 連絡に使わなくなった添付画像を消す。
 * 送信に失敗したあとに画像を差し替え・取り消ししたときに呼び、バケットに残らないようにする。
 * 消せなくても送信の妨げにはしないので、失敗は警告だけにとどめる
 */
export async function removeInquiryImage(path: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from("vendor-images").remove([path]);
  if (error) console.warn("[removeInquiryImage] 画像を削除できませんでした:", error.message);
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
  if (!res.ok) throw await readError(res, "送信できませんでした");
  const data = (await res.json()) as { inquiry: VendorInquiry };
  return data.inquiry;
}

export async function replyToInquiry(id: string, body: string): Promise<VendorInquiryReply> {
  const res = await fetch(`/api/vendor/inquiries/${id}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw await readError(res, "返信できませんでした");
  const data = (await res.json()) as { reply: VendorInquiryReply };
  return data.reply;
}
