// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const guard = vi.fn();
const logAdminAudit = vi.fn();
const upload = vi.fn();
const storageList = vi.fn();
const storageRemove = vi.fn();
const vendorUpdates: Record<string, unknown>[] = [];
let vendor: Record<string, unknown> | null;

vi.mock("@/lib/admin/shopApiGuard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/shopApiGuard")>()),
  guardAdminShopWrite: (...args: unknown[]) => guard(...args),
}));
vi.mock("@/lib/audit/logAdminAudit", () => ({ logAdminAudit: (...args: unknown[]) => logAdminAudit(...args) }));
vi.mock("@/app/(public)/map/services/shopCache", () => ({ revalidatePublicShops: vi.fn() }));

import { POST } from "./route";
import { STORE_IMAGE_CONFIG } from "@/lib/image/clientCompression";

const ID = "00000000-0000-4000-8000-00000000000b";

/** ブラウザで縮小済みの写真。iPhone の Safari は WebP を書き出せず、PNG や JPEG で届く */
const photo = (format: "png" | "jpeg" | "webp", width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#33aa66" } })
    .toFormat(format)
    .toBuffer();

/** トリガーが付けた保存値。アプリの時計とは違う値にして、返り値がこちらであることを確かめる */
const DB_UPDATED_AT = "2020-01-02T03:04:05.678+00:00";

async function post(main: Buffer | null, thumb: Buffer, kind?: string) {
  const form = new FormData();
  if (main) form.append("main", new Blob([new Uint8Array(main)]), "main");
  if (kind) form.append("kind", kind);
  form.append("thumb", new Blob([new Uint8Array(thumb)]), "thumb");
  return POST(new Request(`https://nicchyo.example/api/admin/shops/${ID}/image`, { method: "POST", body: form }), {
    params: Promise.resolve({ id: ID }),
  });
}

/** upload に渡された path → [bytes, options] */
const uploaded = () =>
  new Map(upload.mock.calls.map(([path, bytes, options]) => [path as string, { bytes: bytes as Uint8Array, options }]));

beforeEach(() => {
  vi.clearAllMocks();
  vendorUpdates.length = 0;
  vendor = { shop_name: "山田農園", photo_use_allowed: true };
  upload.mockResolvedValue({ error: null });
  storageList.mockResolvedValue({ data: [{ name: "store-main.png" }, { name: "store-main.webp" }, { name: "store-thumb.webp" }] });
  storageRemove.mockResolvedValue({ error: null });
  logAdminAudit.mockResolvedValue(undefined);

  const adminClient = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: vendor, error: null }) }) }),
      update: (values: Record<string, unknown>) => {
        vendorUpdates.push(values);
        return {
          eq: () => ({
            select: () => ({ single: async () => ({ data: { updated_at: DB_UPDATED_AT }, error: null }) }),
          }),
        };
      },
    }),
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => upload(...args),
        list: (...args: unknown[]) => storageList(...args),
        remove: (...args: unknown[]) => storageRemove(...args),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/${path}` } }),
      }),
    },
  };
  guard.mockResolvedValue({
    ctx: { user: { id: "admin-1", email: "a@example.com" }, role: "admin", adminClient, ip: null, id: ID },
  });
});

describe("POST /api/admin/shops/[id]/image", () => {
  it("PNG で届いた写真（iPhone の Safari）を WebP にして、メインとサムネイルの両方を置く", async () => {
    const res = await post(await photo("png", 900, 1200), await photo("png", 120, 160));

    expect(res.status).toBe(200);
    const files = uploaded();
    expect([...files.keys()]).toEqual([`${ID}/store-main.webp`, `${ID}/store-thumb.webp`]);
    for (const { bytes, options } of files.values()) {
      expect(options).toEqual({ contentType: "image/webp", upsert: true });
      expect((await sharp(bytes).metadata()).format).toBe("webp");
    }
    expect(vendorUpdates[0]).toEqual(
      expect.objectContaining({ shop_image_url: expect.stringMatching(new RegExp(`/storage/${ID}/store-main\\.webp\\?v=\\d+$`)) }),
    );
    // 前に置いた PNG のメインは消す
    expect(storageRemove).toHaveBeenCalledWith([`${ID}/store-main.png`]);
  });

  it("返す updated_at は、アプリの時計ではなく DB に保存された値（次の保存が 409 にならない）", async () => {
    const res = await post(await photo("png", 900, 1200), await photo("png", 120, 160));

    expect((await res.json()).updated_at).toBe(DB_UPDATED_AT);
    expect(vendorUpdates[0]).not.toHaveProperty("updated_at");
  });

  it("JPEG で届いた写真も WebP にして、ブラウザでの縮小と同じ大きさに収める", async () => {
    // サムネイルの長辺（STORE_IMAGE_CONFIG.thumbnail.maxDimension）より大きく届いたものも縮める
    const thumbMax = STORE_IMAGE_CONFIG.thumbnail.maxDimension;
    const res = await post(await photo("jpeg", 2400, 1600), await photo("jpeg", thumbMax * 2, thumbMax * 1.5));

    expect(res.status).toBe(200);
    const files = uploaded();
    const main = await sharp(files.get(`${ID}/store-main.webp`)!.bytes).metadata();
    const thumb = await sharp(files.get(`${ID}/store-thumb.webp`)!.bytes).metadata();
    expect([main.format, main.width, main.height]).toEqual(["webp", 1200, 800]);
    expect([thumb.format, thumb.width, thumb.height]).toEqual(["webp", thumbMax, thumbMax * 0.75]);
  });

  it("WebP で届いた写真は変換せず、そのまま置く", async () => {
    const main = await photo("webp", 1200, 900);
    const thumb = await photo("webp", 160, 120);

    await post(main, thumb);

    const files = uploaded();
    expect(Buffer.from(files.get(`${ID}/store-main.webp`)!.bytes).equals(main)).toBe(true);
    expect(Buffer.from(files.get(`${ID}/store-thumb.webp`)!.bytes).equals(thumb)).toBe(true);
  });

  it("サムネイルが画像でなければ、メインだけ置いて成功にする", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await post(await photo("png", 900, 1200), Buffer.from("<html>not an image</html>"));

    expect(res.status).toBe(200);
    expect([...uploaded().keys()]).toEqual([`${ID}/store-main.webp`]);
    warn.mockRestore();
  });

  it("メインが画像でなければ 400 で、何も置かない", async () => {
    const res = await post(Buffer.from("<html>not an image</html>"), await photo("png", 120, 160));

    expect(res.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it("写真の使用許可がない店舗には保存しない（403）", async () => {
    vendor = { ...vendor!, photo_use_allowed: false };

    const res = await post(await photo("png", 900, 1200), await photo("png", 120, 160));

    expect(res.status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
  });

  it("全周写真は、PNG で届いても長辺2400pxのまま WebP にする（普通の写真の1200pxには縮めない）", async () => {
    const res = await post(await photo("png", 3000, 1500), await photo("png", 600, 450), "panorama");

    expect(res.status).toBe(200);
    const main = await sharp(uploaded().get(`${ID}/store-main.webp`)!.bytes).metadata();
    expect([main.format, main.width, main.height]).toEqual(["webp", 2400, 1200]);
  });

  describe("全周写真のサムネイルだけを差し替える（メインなし）", () => {
    const registered = { shop_name: "山田農園", photo_use_allowed: true, shop_image_kind: "panorama", shop_image_url: `https://x.supabase.co/storage/${ID}/store-main.webp?v=1` };

    it("サムネイルだけ置き直し、メインの URL は版だけ新しくする", async () => {
      vendor = registered;

      const res = await post(null, await photo("webp", 600, 450));

      expect(res.status).toBe(200);
      expect([...uploaded().keys()]).toEqual([`${ID}/store-thumb.webp`]);
      expect(vendorUpdates[0]).toEqual({ shop_image_url: expect.stringMatching(new RegExp(`/store-main\\.webp\\?v=(?!1$)\\d+$`)) });
      expect((await res.json()).updated_at).toBe(DB_UPDATED_AT);
    });

    it("全周写真が登録されていない店舗には、サムネイルだけ置けない", async () => {
      vendor = { ...registered, shop_image_kind: "normal" };

      const res = await post(null, await photo("webp", 600, 450));

      expect(res.status).toBe(400);
      expect(upload).not.toHaveBeenCalled();
    });
  });
});
