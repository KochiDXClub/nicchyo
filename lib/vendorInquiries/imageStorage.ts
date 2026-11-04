/** DBには公開URLや署名を保存せず、非公開バケット内の参照だけを保存する。 */
export const INQUIRY_IMAGE_BUCKET = "vendor-inquiry-images";
const PREFIX = "inquiry-image:";
const PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/inquiries\/[a-zA-Z0-9_-]+\.(webp|png|jpe?g)$/i;

export function inquiryImageReference(path: string): string {
  if (!PATH.test(path)) throw new Error("Invalid inquiry image path");
  return PREFIX + path;
}

export function inquiryImagePath(value: string | null | undefined, vendorId?: string | null): string | null {
  if (!value?.startsWith(PREFIX)) return null;
  const path = value.slice(PREFIX.length);
  if (!PATH.test(path) || (vendorId !== undefined && path.split("/")[0] !== vendorId)) return null;
  return path;
}
