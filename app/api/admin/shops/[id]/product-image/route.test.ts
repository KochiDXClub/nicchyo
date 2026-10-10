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
let productRowsAll: { id: string; image_url: string | null }[] | null;
let updateError: unknown;

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
  productRowsAll = null;
  updateError = null;
  upload.mockResolvedValue({ error: null });
  storageList.mockResolvedValue({ data: [{ name: "product-p1.jpg" }, { name: "product-p1.webp" }, { name: "product-p2.webp" }] });
  storageRemove.mockResolvedValue({ error: null });
  logAdminAudit.mockResolvedValue(undefined);

  const adminClient = {
    from: (table: string) => {
      if (table === "vendors") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: vendor, error: null }) }) }) };
      return {
        select: () => {
          const chain = {
            eq: () => chain,
            order: () => chain,
            limit: () => chain,
            maybeSingle: async () => ({ data: productRow, error: null }),
            // 同じ名前の行を全部読むとき（await するだけ）
            then: (resolve: (value: unknown) => void) =>
              resolve({ data: productRowsAll ?? (productRow ? [productRow] : []), error: null }),
          };
          return chain;
        },
        insert: (values: unknown) => {
          productInserts.push(values);
          return { select: () => ({ single: async () => ({ data: { id: "p-new" }, error: null }) }) };
        },
        update: (values: Record<string, unknown>) => {
          const call = { values, filters: [] as [string, unknown][] };
          productUpdates.push(call);
          const chain = { eq: (c: string, v: unknown) => (call.filters.push([c, v]), c === "vendor_id" ? Promise.resolve({ error: updateError }) : chain) };
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
    // 画面に出ていた写真の一覧を、名前で絞って多めに取る（100件の既定だと見落とす）
    expect(storageList).toHaveBeenCalledWith(ID, { limit: 1000, search: "product-p-new." });
  });

  it("同じ名前の商品の行があれば、それに写真を置く（行は増やさない）。古い別形式の写真は消す", async () => {
    productRow = { id: "p1", image_url: null };
    const res = await post({ name: "トマト", photo: new Blob([await png()]) });

    expect(res.status).toBe(200);
    expect(productInserts).toHaveLength(0);
    expect(upload.mock.calls[0][0]).toBe(`${ID}/product-p1.webp`);
    expect(storageRemove).toHaveBeenCalledWith([`${ID}/product-p1.jpg`]);
  });

  it("前の写真が別の商品 id のファイルを指していても（出店者側の保存で id が変わったとき）、新しい URL を書いてから消す", async () => {
    productRow = { id: "p1", image_url: `https://x.supabase.co/storage/v1/object/public/vendor-images/${ID}/product-abc123-def.webp?v=1` };
    const order: string[] = [];
    productUpdates.length = 0;
    storageRemove.mockImplementation(async () => (order.push(productUpdates.length > 0 ? "after-update" : "before-update"), { error: null }));

    const res = await post({ name: "トマト", photo: new Blob([await png()]) });

    expect(res.status).toBe(200);
    expect(storageRemove).toHaveBeenCalledWith([`${ID}/product-p1.jpg`, `${ID}/product-abc123-def.webp`]);
    expect(order).toEqual(["after-update"]);
  });

  it("URL を書けなかったら、前の写真は消さず、今回置いた写真だけ片付けて 500", async () => {
    productRow = { id: "p1", image_url: `https://x.supabase.co/storage/v1/object/public/vendor-images/${ID}/product-p1.jpg` };
    updateError = { message: "down" };

    const res = await post({ name: "トマト", photo: new Blob([await png()]) });

    expect(res.status).toBe(500);
    expect(storageRemove).toHaveBeenCalledTimes(1);
    expect(storageRemove).toHaveBeenCalledWith([`${ID}/product-p1.webp`]);
    expect(logAdminAudit).not.toHaveBeenCalled();
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

  it("同じ名前の行が複数あっても、写真のある行を全部外す。URL が指す前の id のファイルも消す", async () => {
    productRowsAll = [
      { id: "p1", image_url: `https://x.supabase.co/storage/v1/object/public/vendor-images/${ID}/product-abc123-def.webp` },
      { id: "p9", image_url: `https://x.supabase.co/storage/v1/object/public/vendor-images/${ID}/product-fed9-01.webp` },
      { id: "p8", image_url: null },
    ];
    storageList.mockResolvedValue({ data: [] });

    const res = await del({ name: "トマト" });

    expect(res.status).toBe(200);
    expect(productUpdates.map((u) => u.filters)).toEqual([
      [["id", "p1"], ["vendor_id", ID]],
      [["id", "p9"], ["vendor_id", ID]],
    ]);
    expect(storageRemove).toHaveBeenCalledWith([`${ID}/product-abc123-def.webp`]);
    expect(storageRemove).toHaveBeenCalledWith([`${ID}/product-fed9-01.webp`]);
  });

  it("他店舗のフォルダを指す URL が書かれていても、そのファイルは消さない", async () => {
    productRow = { id: "p1", image_url: "https://x.supabase.co/storage/v1/object/public/vendor-images/other-vendor/product-p1.webp" };
    storageList.mockResolvedValue({ data: [] });

    const res = await del({ name: "トマト" });

    expect(res.status).toBe(200);
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it("写真ファイルを消し切れなかったときは、cleanup: partial で知らせる", async () => {
    productRow = { id: "p1", image_url: "https://x.supabase.co/storage/v1/object/public/vendor-images/" + ID + "/product-p1.webp" };
    storageList.mockResolvedValue({ data: [{ name: "product-p1.webp" }] });
    storageRemove.mockResolvedValue({ error: { message: "down" } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const body = (await (await del({ name: "トマト" })).json()) as { ok: boolean; cleanup?: string };

    expect(body).toEqual(expect.objectContaining({ ok: true, cleanup: "partial" }));
    warn.mockRestore();
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
