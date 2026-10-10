// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const guard = vi.fn();
const logAdminAudit = vi.fn();
const upload = vi.fn();
const storageList = vi.fn();
const storageRemove = vi.fn();
const productUpdates: { values: Record<string, unknown>; filters: [string, unknown][] }[] = [];
const productInserts: unknown[] = [];
let vendor: Record<string, unknown> | null;
let productRow: { id: string; image_url: string | null } | null;

vi.mock("@/lib/admin/shopApiGuard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/shopApiGuard")>()),
  guardAdminShopWrite: (...args: unknown[]) => guard(...args),
}));
vi.mock("@/lib/audit/logAdminAudit", () => ({ logAdminAudit: (...args: unknown[]) => logAdminAudit(...args) }));

import { DELETE, POST } from "./route";

const ID = "00000000-0000-4000-8000-00000000000a";
const URL_ = `https://nicchyo.example/api/admin/shops/${ID}/product-image`;

/** 実際に読める PNG（サーバーが WebP に変換できることを確かめる） */
const png = () =>
  sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#cc3300" } })
    .png()
    .toBuffer();

async function post(fields: { name?: string; photo?: Blob | null }) {
  const form = new FormData();
  if (fields.name !== undefined) form.append("name", fields.name);
  if (fields.photo) form.append("photo", fields.photo, "photo");
  return POST(new Request(URL_, { method: "POST", body: form }), { params: Promise.resolve({ id: ID }) });
}

const del = (body: unknown) =>
  DELETE(new Request(URL_, { method: "DELETE", body: JSON.stringify(body) }), { params: Promise.resolve({ id: ID }) });

beforeEach(() => {
  vi.clearAllMocks();
  productUpdates.length = 0;
  productInserts.length = 0;
  vendor = { shop_name: "山田農園", photo_use_allowed: true, main_products: ["トマト"] };
  productRow = null;
  upload.mockResolvedValue({ error: null });
  storageList.mockResolvedValue({ data: [{ name: "product-p1.jpg" }, { name: "product-p1.webp" }, { name: "product-p2.webp" }] });
  storageRemove.mockResolvedValue({ error: null });
  logAdminAudit.mockResolvedValue(undefined);

  const adminClient = {
    from: (table: string) => {
      if (table === "vendors") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: vendor, error: null }) }) }) };
      return {
        select: () => {
          const chain = { eq: () => chain, limit: () => chain, maybeSingle: async () => ({ data: productRow, error: null }) };
          return chain;
        },
        insert: (values: unknown) => {
          productInserts.push(values);
          return { select: () => ({ single: async () => ({ data: { id: "p-new" }, error: null }) }) };
        },
        update: (values: Record<string, unknown>) => {
          const call = { values, filters: [] as [string, unknown][] };
          productUpdates.push(call);
          const chain = { eq: (c: string, v: unknown) => (call.filters.push([c, v]), c === "vendor_id" ? Promise.resolve({ error: null }) : chain) };
          return chain;
        },
      };
    },
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => upload(...args),
        list: (...args: unknown[]) => storageList(...args),
        remove: (...args: unknown[]) => storageRemove(...args),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/${path}` } }),
      }),
    },
  };
  guard.mockImplementation(async (request: Request) => ({
    ctx: { user: { id: "admin-1", email: "a@example.com" }, role: "admin", adminClient, ip: null, id: ID },
    body: request.method === "DELETE" ? await request.json() : null,
  }));
});

describe("POST /api/admin/shops/[id]/product-image", () => {
  it("写真の使用許可がない店舗には保存しない（403）", async () => {
    vendor = { ...vendor!, photo_use_allowed: false };
    const res = await post({ name: "トマト", photo: new Blob([await png()]) });
    expect(res.status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
  });

  it("店舗が無ければ 404", async () => {
    vendor = null;
    expect((await post({ name: "トマト", photo: new Blob([await png()]) })).status).toBe(404);
  });

  it("保存済みの主な商品にない名前は断る（掃除されない行を作らない）", async () => {
    const res = await post({ name: "なす", photo: new Blob([await png()]) });
    expect(res.status).toBe(400);
    expect(productInserts).toHaveLength(0);
    expect(upload).not.toHaveBeenCalled();
  });

  it("商品名や写真が無い・画像でないものは 400", async () => {
    expect((await post({ photo: new Blob([await png()]) })).status).toBe(400);
    expect((await post({ name: "トマト" })).status).toBe(400);
    expect((await post({ name: "トマト", photo: new Blob(["<html>not an image</html>"]) })).status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it("5MB を超える写真は 413", async () => {
    const res = await post({ name: "トマト", photo: new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]) });
    expect(res.status).toBe(413);
  });

  it("PNG を送っても、1200px 以内の WebP にして products の行に置き、監査ログを残す", async () => {
    const res = await post({ name: "トマト", photo: new Blob([await png()], { type: "image/png" }) });

    expect(res.status).toBe(200);
    expect(productInserts).toEqual([{ vendor_id: ID, name: "トマト" }]);
    const [path, bytes, options] = upload.mock.calls[0];
    expect(path).toBe(`${ID}/product-p-new.webp`);
    expect(options).toEqual({ contentType: "image/webp", upsert: true });
    const meta = await sharp(bytes as Buffer).metadata();
    expect(meta.format).toBe("webp");
    expect(Math.max(meta.width!, meta.height!)).toBe(1200);

    const body = (await res.json()) as { url: string };
    expect(body.url).toMatch(new RegExp(`^https://x\\.supabase\\.co/storage/${ID}/product-p-new\\.webp\\?v=\\d+$`));
    expect(productUpdates[0].values).toEqual(expect.objectContaining({ image_url: body.url }));
    expect(logAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "admin-1" }),
      expect.objectContaining({ action: "product_image_upload", targetId: ID }),
    );
    // 新しい商品には前回の写真が無いので、ほかの商品の写真は消さない
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it("同じ名前の商品の行があれば、それに写真を置く（行は増やさない）。古い別形式の写真は消す", async () => {
    productRow = { id: "p1", image_url: null };
    const res = await post({ name: "トマト", photo: new Blob([await png()]) });

    expect(res.status).toBe(200);
    expect(productInserts).toHaveLength(0);
    expect(upload.mock.calls[0][0]).toBe(`${ID}/product-p1.webp`);
    expect(storageRemove).toHaveBeenCalledWith([`${ID}/product-p1.jpg`]);
  });
});

describe("DELETE /api/admin/shops/[id]/product-image", () => {
  it("写真を外すと、URL を空にして写真ファイルも消す（許可がなくても外せる）", async () => {
    vendor = { ...vendor!, photo_use_allowed: false };
    productRow = { id: "p1", image_url: "https://x.supabase.co/storage/p1.webp" };

    const res = await del({ name: "トマト" });

    expect(res.status).toBe(200);
    expect(productUpdates[0].values).toEqual(expect.objectContaining({ image_url: null }));
    expect(storageRemove).toHaveBeenCalledWith([`${ID}/product-p1.jpg`, `${ID}/product-p1.webp`]);
    expect(logAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: "product_image_delete" }),
    );
  });

  it("写真が無い商品を外しても成功にして、何も書かない", async () => {
    productRow = { id: "p1", image_url: null };
    expect((await del({ name: "トマト" })).status).toBe(200);
    expect(productUpdates).toHaveLength(0);
    expect(logAdminAudit).not.toHaveBeenCalled();
  });

  it("商品名が空なら 400", async () => {
    expect((await del({ name: "  " })).status).toBe(400);
    expect((await del({})).status).toBe(400);
  });
});
