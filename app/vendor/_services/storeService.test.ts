import { beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn();
const list = vi.fn();
const remove = vi.fn();
const getPublicUrl = vi.fn((path: string) => ({ data: { publicUrl: `https://example.supabase.co/${path}` } }));

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    storage: { from: () => ({ upload, list, remove, getPublicUrl }) },
  }),
}));

const createStoreImages = vi.fn();
vi.mock("@/lib/image/clientCompression", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/image/clientCompression")>()),
  createStoreImages: (file: File) => createStoreImages(file),
}));

import { uploadStoreImage } from "./storeService";

describe("uploadStoreImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upload.mockResolvedValue({ error: null });
    remove.mockResolvedValue({ error: null });
  });

  const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });

  it("WebP で書き出せたら store-main.webp として保存し、他の形式の古い画像を消す", async () => {
    createStoreImages.mockResolvedValue({
      mainBlob: new Blob(["m"], { type: "image/webp" }),
      thumbBlob: new Blob(["t"], { type: "image/webp" }),
    });
    list.mockResolvedValue({ data: [{ name: "store-main.webp" }, { name: "store-main.jpg" }, { name: "store-thumb.webp" }] });

    const url = await uploadStoreImage("v1", file);

    expect(upload).toHaveBeenCalledWith("v1/store-main.webp", expect.any(Blob), { contentType: "image/webp", upsert: true });
    expect(upload).toHaveBeenCalledWith("v1/store-thumb.webp", expect.any(Blob), { contentType: "image/webp", upsert: true });
    expect(remove).toHaveBeenCalledWith(["v1/store-main.jpg"]);
    expect(url).toBe("https://example.supabase.co/v1/store-main.webp");
  });

  it("WebP を書き出せず JPEG になったら、中身どおり image/jpeg で保存する", async () => {
    createStoreImages.mockResolvedValue({
      mainBlob: new Blob(["m"], { type: "image/jpeg" }),
      thumbBlob: new Blob(["t"], { type: "image/jpeg" }),
    });
    list.mockResolvedValue({ data: [{ name: "store-main.webp" }, { name: "store-main.jpg" }] });

    const url = await uploadStoreImage("v1", file);

    expect(upload).toHaveBeenCalledWith("v1/store-main.jpg", expect.any(Blob), { contentType: "image/jpeg", upsert: true });
    // サムネイルは URL を store-thumb.webp で組み立てるので名前は固定し、Content-Type だけ合わせる
    expect(upload).toHaveBeenCalledWith("v1/store-thumb.webp", expect.any(Blob), { contentType: "image/jpeg", upsert: true });
    // 今保存した store-main.jpg は消さず、前回の store-main.webp を消す
    expect(remove).toHaveBeenCalledWith(["v1/store-main.webp"]);
    expect(url).toBe("https://example.supabase.co/v1/store-main.jpg");
  });
});
