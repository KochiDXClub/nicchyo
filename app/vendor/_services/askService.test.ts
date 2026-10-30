import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { table: string; op: string; payload?: unknown; filters: string[] };
type Result = { data?: unknown; error?: unknown };

const calls: Call[] = [];
let respond: (call: Call) => Result = () => ({ data: null, error: null });
const storageList = vi.fn();
const storageRemove = vi.fn();
const storageUpload = vi.fn();

/** 呼ばれた操作を記録し、respond で返事を決める Supabase の代わり */
function fakeClient() {
  return {
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      const builder = {
        select: () => builder,
        update: (payload: unknown) => Object.assign(call, { op: "update", payload }) && builder,
        insert: (payload: unknown) => Object.assign(call, { op: "insert", payload }) && builder,
        upsert: (payload: unknown) => Object.assign(call, { op: "upsert", payload }) && builder,
        delete: () => Object.assign(call, { op: "delete" }) && builder,
        eq: (column: string, value: unknown) => {
          call.filters.push(`${column}=${String(value)}`);
          return builder;
        },
        order: () => builder,
        in: (column: string, values: unknown[]) => {
          call.filters.push(`${column} in ${values.join(",")}`);
          return builder;
        },
        limit: () => builder,
        single: () => builder,
        maybeSingle: () => builder,
        then(resolve: (value: Result) => void) {
          calls.push(call);
          resolve(respond(call));
        },
      };
      return builder;
    },
    storage: {
      from: () => ({
        list: storageList,
        remove: storageRemove,
        upload: storageUpload,
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.supabase.co/${path}` } }),
      }),
    },
  };
}

vi.mock("@/utils/supabase/client", () => ({ createClient: () => fakeClient() }));
vi.mock("./storeService", () => ({ uploadStoreImage: vi.fn() }));
// 写真の WebP 変換はブラウザの Canvas を使うので、変換済みの Blob を返す代わりに差し替える
vi.mock("@/lib/image/clientCompression", () => ({
  STORE_IMAGE_CONFIG: { main: {} },
  resizeImageToBlob: vi.fn(async () => new Blob(["webp"], { type: "image/webp" })),
  imageUploadInfo: (blob: Blob) => ({ contentType: blob.type, ext: "webp" }),
}));

import { AskUserFacingError, fetchAskSnapshot, saveAskAnswer } from "./askService";

const writes = () => calls.filter((call) => call.op !== "select");

beforeEach(() => {
  calls.length = 0;
  storageList.mockReset();
  storageRemove.mockReset();
  storageUpload.mockReset();
  storageUpload.mockResolvedValue({ error: null });
  // vendors の更新は、更新できた行を返す
  respond = (call) =>
    call.table === "vendors" && call.op === "update" ? { data: [{ id: "v1" }], error: null } : { data: null, error: null };
});

describe("saveAskAnswer（どの列に書くか）", () => {
  it("X は sns_x に、空なら null で書く", async () => {
    await saveAskAnswer("v1", "2026-10-04", { id: "x", value: "  " });
    expect(writes()).toEqual([
      expect.objectContaining({ table: "vendors", op: "update", payload: expect.objectContaining({ sns_x: null }) }),
    ]);
  });

  it("ジャンルを消すと category_id を null にする", async () => {
    await saveAskAnswer("v1", "2026-10-04", { id: "category", categoryId: "" });
    expect(writes()[0].payload).toEqual(expect.objectContaining({ category_id: null }));
  });

  it("主な商品と値段は、名前の一覧と名前ごとの値段に分けて書く", async () => {
    await saveAskAnswer("v1", "2026-10-04", {
      id: "products",
      items: [
        { name: "トマト", price: 300 },
        { name: "なす", price: null },
      ],
    });
    expect(writes()[0].payload).toEqual(
      expect.objectContaining({ main_products: ["トマト", "なす"], main_product_prices: { トマト: 300, なす: null } })
    );
  });

  it("店主名は vendor_owner_profiles に、公開の設定と一緒に書く（消すときは名前を null・非公開）", async () => {
    await saveAskAnswer("v1", "2026-10-04", { id: "owner", name: "", isPublic: false });
    expect(writes()).toEqual([
      expect.objectContaining({
        table: "vendor_owner_profiles",
        op: "upsert",
        payload: { vendor_id: "v1", owner_name: null, is_public: false },
      }),
    ]);
  });

  it("店舗写真を消すと、店舗情報から外し、Storage の写真も消す", async () => {
    storageList.mockResolvedValue({ data: [{ name: "store-main.webp" }, { name: "store-thumb.webp" }, { name: "p1.webp" }] });
    storageRemove.mockResolvedValue({ error: null });

    await saveAskAnswer("v1", "2026-10-04", { id: "shop-photo", imageFile: null });

    expect(writes()[0].payload).toEqual(expect.objectContaining({ shop_image_url: null }));
    expect(storageRemove).toHaveBeenCalledWith(["v1/store-main.webp", "v1/store-thumb.webp"]);
  });

  it("vendors の更新が0件なら、成功と取り違えない", async () => {
    respond = () => ({ data: [], error: null });
    await expect(saveAskAnswer("v1", "2026-10-04", { id: "x", value: "@a" })).rejects.toBeInstanceOf(AskUserFacingError);
  });

  it("看板商品の名前だけ直したときは、前の看板商品の写真を引き継ぐ", async () => {
    respond = (call) => {
      if (call.table === "vendors" && call.op === "select" && call.filters.includes("id=v1")) {
        return { data: { signature_product_name: "旧トマト", main_products: [] }, error: null };
      }
      if (call.table === "products" && call.op === "select" && call.filters.includes("name=旧トマト")) {
        return { data: { id: "p-old", image_url: "https://example.supabase.co/old.webp" }, error: null };
      }
      if (call.table === "products" && call.op === "insert") return { data: { id: "p-new" }, error: null };
      if (call.table === "vendors" && call.op === "update") return { data: [{ id: "v1" }], error: null };
      return { data: null, error: null };
    };

    await saveAskAnswer("v1", "2026-10-04", { id: "signature", name: "新トマト", imageFile: null });

    expect(writes().find((call) => call.table === "products" && call.op === "insert")?.payload).toEqual({
      vendor_id: "v1",
      name: "新トマト",
      image_url: "https://example.supabase.co/old.webp",
    });
  });
});

describe("主な商品の写真", () => {
  const photo = new File(["x"], "tomato.jpg", { type: "image/jpeg" });
  const productRows = (
    rows: { id: string; name: string; image_url: string | null; description?: string | null }[],
    vendor: object = {},
    seasons: { product_id: string }[] = []
  ) => {
    respond = (call) => {
      if (call.table === "vendors" && call.op === "select") return { data: { main_products: [], ...vendor }, error: null };
      if (call.table === "vendors" && call.op === "update") return { data: [{ id: "v1" }], error: null };
      if (call.table === "product_seasons") return { data: seasons, error: null };
      if (call.table === "products" && call.op === "select") return { data: rows, error: null };
      if (call.table === "products" && call.op === "insert") return { data: { id: "p-new" }, error: null };
      return { data: null, error: null };
    };
  };

  it("新しい商品に写真をつけると、商品の行を作り、WebP で保存して URL を書く", async () => {
    productRows([]);
    await saveAskAnswer("v1", "2026-10-04", {
      id: "products",
      items: [{ name: "トマト", price: 300, imageFile: photo }],
    });

    expect(storageUpload).toHaveBeenCalledWith("v1/product-p-new.webp", expect.any(Blob), {
      contentType: "image/webp",
      upsert: true,
    });
    const productWrites = writes().filter((call) => call.table === "products");
    expect(productWrites[0]).toEqual(expect.objectContaining({ op: "insert", payload: { vendor_id: "v1", name: "トマト" } }));
    expect(productWrites[1]).toEqual(
      expect.objectContaining({
        op: "update",
        payload: expect.objectContaining({ image_url: expect.stringMatching(/^https:\/\/example\.supabase\.co\/v1\/product-p-new\.webp\?v=\d+$/) }),
      })
    );
    // 名前と値段は、これまでどおり vendors に書く
    expect(writes().at(-1)).toEqual(
      expect.objectContaining({
        table: "vendors",
        payload: expect.objectContaining({ main_products: ["トマト"], main_product_prices: { トマト: 300 } }),
      })
    );
  });

  it("写真を触っていない商品は、products にも Storage にも何も書かない", async () => {
    productRows([{ id: "p1", name: "トマト", image_url: "https://example.supabase.co/v1/product-p1.webp" }], {
      main_products: ["トマト"],
    });
    await saveAskAnswer("v1", "2026-10-04", { id: "products", items: [{ name: "トマト", price: 350 }] });

    expect(writes().map((call) => call.table)).toEqual(["vendors"]);
    expect(storageUpload).not.toHaveBeenCalled();
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it("写真を外すと、商品の URL を null にして、Storage の写真も消す", async () => {
    productRows([{ id: "p1", name: "トマト", image_url: "https://example.supabase.co/v1/product-p1.webp" }], {
      main_products: ["トマト"],
    });
    storageList.mockResolvedValue({ data: [{ name: "product-p1.webp" }, { name: "product-p2.webp" }] });
    storageRemove.mockResolvedValue({ error: null });

    await saveAskAnswer("v1", "2026-10-04", { id: "products", items: [{ name: "トマト", price: null, imageFile: null }] });

    expect(writes()[0]).toEqual(
      expect.objectContaining({ table: "products", op: "update", payload: expect.objectContaining({ image_url: null }) })
    );
    expect(storageRemove).toHaveBeenCalledWith(["v1/product-p1.webp"]);
  });

  it("一覧から外した商品のうち、説明も旬も持たない行は、行も写真も消す。看板商品と、画面に出ていない行は残す", async () => {
    productRows(
      [
        { id: "p1", name: "トマト", image_url: null },
        { id: "p2", name: "なす", image_url: "https://example.supabase.co/v1/product-p2.webp" },
        { id: "p3", name: "看板の柿", image_url: null },
        { id: "p4", name: "昔の商品", image_url: null },
      ],
      { main_products: ["トマト", "なす", "看板の柿"], signature_product_name: "看板の柿" }
    );
    storageList.mockResolvedValue({ data: [{ name: "product-p2.webp" }] });
    storageRemove.mockResolvedValue({ error: null });

    await saveAskAnswer("v1", "2026-10-04", { id: "products", items: [{ name: "トマト", price: null }] });

    const deletes = calls.filter((call) => call.op === "delete");
    expect(deletes).toEqual([expect.objectContaining({ table: "products", filters: ["id=p2", "vendor_id=v1"] })]);
    expect(storageRemove).toHaveBeenCalledWith(["v1/product-p2.webp"]);
  });

  it("一覧から外した商品でも、説明か旬を持つ行は消さない（マイショップで登録したものを巻き込まない）。写真だけ外す", async () => {
    productRows(
      [
        { id: "p1", name: "説明つき", image_url: "https://example.supabase.co/v1/product-p1.webp", description: "朝採れ" },
        { id: "p2", name: "旬つき", image_url: "https://example.supabase.co/v1/product-p2.webp", description: null },
        { id: "p3", name: "旬つき・写真なし", image_url: null, description: null },
      ] as never,
      { main_products: ["説明つき", "旬つき", "旬つき・写真なし"] },
      [{ product_id: "p2" }, { product_id: "p3" }]
    );
    storageList.mockResolvedValue({ data: [{ name: "product-p1.webp" }, { name: "product-p2.webp" }] });
    storageRemove.mockResolvedValue({ error: null });

    await saveAskAnswer("v1", "2026-10-04", { id: "products", items: [] });

    expect(calls.filter((call) => call.op === "delete")).toEqual([]);
    const imageClears = writes().filter((call) => call.table === "products" && call.op === "update");
    expect(imageClears.map((call) => call.filters[0])).toEqual(["id=p1", "id=p2"]);
    expect(imageClears.every((call) => (call.payload as { image_url: unknown }).image_url === null)).toBe(true);
    expect(storageRemove).toHaveBeenCalledWith(["v1/product-p1.webp"]);
    expect(storageRemove).toHaveBeenCalledWith(["v1/product-p2.webp"]);
  });

  it("一覧の保存に失敗したときは、商品の行も写真も消さない（掃除は一覧の保存のあと）", async () => {
    productRows(
      [{ id: "p2", name: "なす", image_url: null }],
      { main_products: ["なす"] }
    );
    const base = respond;
    respond = (call) => (call.table === "vendors" && call.op === "update" ? { data: [], error: null } : base(call));

    await expect(
      saveAskAnswer("v1", "2026-10-04", { id: "products", items: [] })
    ).rejects.toBeInstanceOf(AskUserFacingError);

    expect(calls.filter((call) => call.op === "delete")).toEqual([]);
    expect(storageRemove).not.toHaveBeenCalled();
  });
});

describe("fetchAskSnapshot", () => {
  it("どれか1つでも読めなければ、空として出さずに失敗にする", async () => {
    respond = (call) => {
      if (call.table === "vendors") return { data: { shop_name: "店" }, error: null };
      if (call.table === "vendor_owner_profiles") return { data: null, error: { message: "timeout" } };
      return { data: [], error: null };
    };

    await expect(fetchAskSnapshot("v1", "2026-10-04")).rejects.toBeInstanceOf(AskUserFacingError);
  });

  it("主な商品に、同じ名前の商品の写真をつけて返す", async () => {
    respond = (call) => {
      if (call.table === "vendors") {
        return { data: { shop_name: "店", main_products: ["トマト", "なす"], main_product_prices: { トマト: 300 } }, error: null };
      }
      if (call.table === "products") {
        return { data: [{ id: "p1", name: "トマト", image_url: "https://example.supabase.co/t.webp", description: null }], error: null };
      }
      return { data: call.table === "vendor_weekly_status" || call.table === "vendor_owner_profiles" ? null : [], error: null };
    };

    const snapshot = await fetchAskSnapshot("v1", "2026-10-04");

    expect(snapshot.products).toEqual([
      { name: "トマト", price: 300, imageUrl: "https://example.supabase.co/t.webp" },
      { name: "なす", price: null, imageUrl: undefined },
    ]);
  });
});
