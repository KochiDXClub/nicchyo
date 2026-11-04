import { describe, it, expect, vi } from "vitest";
import { migrateInquiryImages } from "./migrate-inquiry-images.mjs";
const vendor = "11111111-1111-4111-8111-111111111111";
const path = `${vendor}/inquiries/old.webp`;
const oldUrl = `https://p.supabase.co/storage/v1/object/public/vendor-images/${path}`;
const ok = (data: unknown) => ({ data, error: null });
const image = (data: string) => ({ type: "image/webp", arrayBuffer: async () => new TextEncoder().encode(data).buffer });
function fixture({ copied = "original", updateError = false, imageUrl = oldUrl, orphan = false, nested = false, leftover = false } = {}) {
  let current = imageUrl;
  const remove = vi.fn().mockResolvedValue(ok([]));
  const upload = vi.fn().mockResolvedValue(ok({}));
  const updateSelect = vi.fn(async () => {
    if (updateError) return { data: null, error: { message: "database failed" } };
    if (!leftover) current = `inquiry-image:${path}`;
    return ok([{ id: "i" }]);
  });
  const updateEq = { eq: () => updateEq, select: updateSelect };
  const range = vi.fn(async (offset: number) => ok(offset || orphan ? [] : [{ id: "i", vendor_id: vendor, image_url: current }]));
  const from = vi.fn().mockReturnValue({ select: () => ({ not: () => ({ order: () => ({ range }) }) }), update: () => updateEq });
  const source = {
    list: vi.fn(async (folder: string, { offset }: { offset: number }) => ok(offset ? [] : folder === "" ? [{ name: vendor }] : [{ id: nested ? null : "object", name: nested ? "subfolder" : "old.webp" }])),
    download: vi.fn().mockResolvedValue(ok(image("original"))), getPublicUrl: () => ({ data: { publicUrl: oldUrl } }), remove,
  };
  const target = { upload, download: vi.fn().mockResolvedValue(ok(image(copied))) };
  const db = { storage: { getBucket: async () => ok({ public: false }), from: (bucket: string) => bucket === "vendor-images" ? source : target }, from };
  return { db, remove, upload, updateSelect };
}
describe("公開添付画像の安全な移行", () => {
  it("dry-runでファイルとDB参照の突合結果を出し、書き込まない", async () => {
    const f = fixture();
    expect(await migrateInquiryImages(f.db)).toMatchObject({ mode: "dry-run", files: 1, referencedRows: 1, referencedFiles: 1, unreferencedFiles: 0 });
    expect(f.upload).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled();
  });
  it("カスタムホストの参照は孤立と誤認せず、applyを停止する", async () => {
    const f = fixture({ imageUrl: oldUrl.replace("p.supabase.co", "custom.example") });
    expect(await migrateInquiryImages(f.db)).toMatchObject({ foreignOriginReferences: 1, referencedFiles: 1, unreferencedFiles: 0 });
    await expect(migrateInquiryImages(f.db, { apply: true })).rejects.toThrow("Unresolved DB references");
    expect(f.upload).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled();
  });
  it("不明な参照があれば削除前に停止する", async () => {
    const f = fixture({ imageUrl: "https://other.example/unknown.webp" });
    await expect(migrateInquiryImages(f.db, { apply: true })).rejects.toThrow("Unresolved DB references");
    expect(f.remove).not.toHaveBeenCalled();
  });
  it("孤立ファイルは既定で残し、明示指定した場合だけ移行する", async () => {
    const f = fixture({ orphan: true });
    expect(await migrateInquiryImages(f.db, { apply: true })).toMatchObject({ skippedUnreferenced: 1, migratedFiles: 0 });
    expect(f.upload).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled();
    expect(await migrateInquiryImages(f.db, { apply: true, includeUnreferenced: true })).toMatchObject({ migratedFiles: 1 });
    expect(f.remove).toHaveBeenCalledWith([path]);
  });
  it("入れ子フォルダを黙って飛ばさず停止する", async () => {
    const f = fixture({ nested: true });
    await expect(migrateInquiryImages(f.db)).rejects.toThrow("Nested legacy folder");
    expect(f.upload).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled();
  });
  it("コピー破損・DB更新失敗では公開側を削除しない", async () => {
    for (const options of [{ copied: "corrupt" }, { updateError: true }]) {
      const f = fixture(options);
      await expect(migrateInquiryImages(f.db, { apply: true })).rejects.toThrow();
      expect(f.remove).not.toHaveBeenCalled();
    }
  });
  it("更新したはずの参照が残っている場合は削除しない", async () => {
    const f = fixture({ leftover: true });
    await expect(migrateInquiryImages(f.db, { apply: true })).rejects.toThrow("Unmigrated reference remains");
    expect(f.remove).not.toHaveBeenCalled();
  });
  it("クエリ付きURLも更新し、照合と参照更新の成功後だけ公開側を削除する", async () => {
    const f = fixture({ imageUrl: oldUrl + "?v=1" });
    expect(await migrateInquiryImages(f.db, { apply: true })).toMatchObject({ migratedFiles: 1 });
    expect(f.remove).toHaveBeenCalledWith([path]);
    expect(f.updateSelect.mock.invocationCallOrder[0]).toBeLessThan(f.remove.mock.invocationCallOrder[0]);
  });
});
