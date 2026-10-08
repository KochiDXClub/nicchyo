import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { table: string; op: string; payload?: unknown; filters: string[] };
type Result = { data?: unknown; error?: unknown };

const calls: Call[] = [];
let respond: (call: Call) => Result = () => ({ data: null, error: null });
const storageList = vi.fn();
const storageRemove = vi.fn();

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
        eq: (column: string, value: unknown) => {
          call.filters.push(`${column}=${String(value)}`);
          return builder;
        },
        order: () => builder,
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
    storage: { from: () => ({ list: storageList, remove: storageRemove }) },
  };
}

vi.mock("@/utils/supabase/client", () => ({ createClient: () => fakeClient() }));
vi.mock("./storeService", () => ({ uploadStoreImage: vi.fn() }));

import { AskUserFacingError, fetchAskSnapshot, saveAskAnswer } from "./askService";

const writes = () => calls.filter((call) => call.op !== "select");

beforeEach(() => {
  calls.length = 0;
  storageList.mockReset();
  storageRemove.mockReset();
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

describe("fetchAskSnapshot", () => {
  it("どれか1つでも読めなければ、空として出さずに失敗にする", async () => {
    respond = (call) => {
      if (call.table === "vendors") return { data: { shop_name: "店" }, error: null };
      if (call.table === "vendor_owner_profiles") return { data: null, error: { message: "timeout" } };
      return { data: [], error: null };
    };

    await expect(fetchAskSnapshot("v1", "2026-10-04")).rejects.toBeInstanceOf(AskUserFacingError);
  });
});
