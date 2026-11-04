import { describe, it, expect, vi } from "vitest";
import { migrateInquiryImages } from "./migrate-inquiry-images.mjs";
const vendor = "11111111-1111-4111-8111-111111111111";
const path = `${vendor}/inquiries/old.webp`;
const oldUrl = `https://p.supabase.co/storage/v1/object/public/vendor-images/${path}`;
const ok = (data: unknown) => ({ data, error: null });
const image = (data: string) => ({ type: "image/webp", arrayBuffer: async () => new TextEncoder().encode(data).buffer });
function fixture({ copied = "original", updateError = false } = {}) {
  const remove = vi.fn().mockResolvedValue(ok([]));
  const upload = vi.fn().mockResolvedValue(ok({}));
  const updateSelect = vi.fn().mockResolvedValue(updateError ? { error: { message: "database failed" } } : ok([{ id: "i" }]));
  const updateEq = { eq: () => updateEq, select: updateSelect };
  const range = vi.fn().mockResolvedValueOnce(ok([{ id: "i", image_url: oldUrl + "?v=1" }])).mockResolvedValue(ok([]));
  const from = vi.fn().mockReturnValue({ select: () => ({ like: () => ({ order: () => ({ range }) }) }), update: () => updateEq });
  const source = {
    list: vi.fn(async (folder: string) => ok(folder === "" ? [{ name: vendor }] : [{ id: "object", name: "old.webp" }])),
    download: vi.fn().mockResolvedValue(ok(image("original"))),
    getPublicUrl: () => ({ data: { publicUrl: oldUrl } }), remove,
  };
  const target = { upload, download: vi.fn().mockResolvedValue(ok(image(copied))) };
  const db = { storage: { getBucket: async () => ok({ public: false }), from: (bucket: string) => bucket === "vendor-images" ? source : target }, from };
  return { db, remove, upload, from, updateSelect };
}
describe("公開添付画像の安全な移行", () => {
  it("既定のdry-runは書き込まず対象数だけ返す", async () => {
    const f = fixture();
    expect(await migrateInquiryImages(f.db)).toEqual({ mode: "dry-run", files: 1 });
    expect(f.upload).not.toHaveBeenCalled(); expect(f.from).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled();
  });
  it("コピー内容が異なると公開側を削除しない", async () => {
    const f = fixture({ copied: "corrupt" });
    await expect(migrateInquiryImages(f.db, { apply: true })).rejects.toThrow("Copy verification failed");
    expect(f.from).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled();
  });
  it("参照更新に失敗したら公開側を削除しない", async () => {
    const f = fixture({ updateError: true });
    await expect(migrateInquiryImages(f.db, { apply: true })).rejects.toThrow("database failed");
    expect(f.remove).not.toHaveBeenCalled();
  });
  it("コピー照合と参照更新の成功後だけ公開側を削除する", async () => {
    const f = fixture();
    await migrateInquiryImages(f.db, { apply: true });
    expect(f.remove).toHaveBeenCalledWith([path]);
    expect(f.updateSelect.mock.invocationCallOrder[0]).toBeLessThan(f.remove.mock.invocationCallOrder[0]);
  });
});
