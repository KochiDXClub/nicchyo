/**
 * /api/grandma/ask の入力検証（JSON / multipart 共通）。
 *
 * text と memorySummary は埋め込み検索とプロンプトの両方に入り、画像は OpenAI(vision) に
 * そのまま送られる。上限を設けないと、1リクエストで大量の入力トークンを課金させられる。
 */
import { z } from "zod";
import { sniffImageType } from "@/lib/admin/imageSniff";

export const ASK_TEXT_MAX = 1000;
export const ASK_MEMORY_SUMMARY_MAX = 800;
export const ASK_SHOP_NAME_MAX = 100;
export const ASK_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const ASK_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const AskTextSchema = z.string().max(ASK_TEXT_MAX);
export const AskMemorySummarySchema = z.string().max(ASK_MEMORY_SUMMARY_MAX);
export const AskShopNameSchema = z.string().max(ASK_SHOP_NAME_MAX);

/** multipart のテキスト項目。JSON 経路のスキーマと同じ上限を使う */
export const AskMultipartTextFieldsSchema = z.object({
  text: AskTextSchema,
  memorySummary: AskMemorySummarySchema,
  shopName: AskShopNameSchema,
});

export const AskLocationSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

/** multipart の location(JSON文字列)。数値・範囲が正しくなければ「位置情報なし」として扱う */
export function parseLocationField(raw: string): { lat: number; lng: number } | null {
  try {
    const parsed = AskLocationSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type AskImageCheck =
  | { ok: true; mime: (typeof ASK_IMAGE_MIME_TYPES)[number] }
  | { ok: false; error: string };

/** 画像のサイズ・申告MIME・中身（先頭バイト）を検証する。送信する形式は中身から決める */
export function checkAskImage(input: {
  size: number;
  declaredType: string;
  head: Uint8Array;
}): AskImageCheck {
  if (input.size > ASK_IMAGE_MAX_BYTES) {
    return { ok: false, error: "画像は5MB以下にしてください" };
  }
  const declared = input.declaredType.toLowerCase();
  // 申告が空のときは中身の判定だけに任せる（申告があるなら許可形式であること）
  if (declared && !(ASK_IMAGE_MIME_TYPES as readonly string[]).includes(declared)) {
    return { ok: false, error: "画像は JPEG / PNG / WebP のみ対応しています" };
  }
  const sniffed = sniffImageType(input.head);
  if (!sniffed) {
    return { ok: false, error: "画像の形式を確認できませんでした" };
  }
  return { ok: true, mime: sniffed };
}
