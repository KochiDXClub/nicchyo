/**
 * アップロードされた画像の中身（先頭のバイト）から形式を判定する。
 * Content-Type はクライアントの自己申告なので信用せず、保存するときの形式はここで決める。
 */
export type SniffedImageType = "image/webp" | "image/jpeg" | "image/png";

export function sniffImageType(bytes: Uint8Array): SniffedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // WebP は "RIFF" + 4 バイトのサイズ + "WEBP"
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export const IMAGE_EXT: Record<SniffedImageType, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};
