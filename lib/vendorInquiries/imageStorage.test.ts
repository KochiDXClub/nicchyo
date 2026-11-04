import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inquiryImagePath, inquiryImageReference, INQUIRY_IMAGE_BUCKET } from "./imageStorage";
import { withSignedInquiryImage } from "./imageStorage.server";
const vendor = "11111111-1111-4111-8111-111111111111";
const path = `${vendor}/inquiries/photo.webp`;
const ref = inquiryImageReference(path);

describe("非公開の連絡画像", () => {
  it("外部URL、旧公開URL、パストラバーサル、別店舗の参照を拒否する", () => {
    for (const bad of ["https://example.test/a.webp", "/images/a.webp", `inquiry-image:${vendor}/inquiries/../x.webp`, `inquiry-image:${path}?token=foo`]) {
      expect(inquiryImagePath(bad, vendor)).toBeNull();
    }
    expect(inquiryImagePath(ref, "22222222-2222-4222-8222-222222222222")).toBeNull();
    expect(inquiryImagePath(ref, null)).toBeNull();
    expect(inquiryImagePath(ref, vendor)).toBe(path);
  });
  it("認可済み店舗の参照だけを5分間の署名URLへ変換する", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://project.supabase.co/signed" }, error: null });
    const from = vi.fn().mockReturnValue({ createSignedUrl });
    const client = { storage: { from } } as unknown as SupabaseClient;
    const inquiry = { vendor_id: vendor, image_url: ref };
    expect((await withSignedInquiryImage(client, inquiry)).image_url).toBe("https://project.supabase.co/signed");
    expect(from).toHaveBeenCalledWith(INQUIRY_IMAGE_BUCKET);
    expect(createSignedUrl).toHaveBeenCalledWith(path, 300);
    expect(inquiry.image_url).toBe(ref);
    await withSignedInquiryImage(client, { vendor_id: null, image_url: ref });
    await withSignedInquiryImage(client, { vendor_id: vendor, image_url: "https://project.supabase.co/storage/v1/object/public/vendor-images/a.webp" });
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });
  it("署名に失敗しても公開URLへフォールバックしない", async () => {
    const client = { storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: { message: "denied" } }) }) } } as unknown as SupabaseClient;
    expect((await withSignedInquiryImage(client, { vendor_id: vendor, image_url: ref })).image_url).toBeNull();
  });
});
