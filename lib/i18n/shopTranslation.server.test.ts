import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Shop } from "@/app/(public)/map/types/shopData";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn() }));
vi.mock("@/lib/supabase/anonClient", () => ({ createAnonClient: vi.fn() }));
vi.mock("@/lib/supabase/adminClient", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/ai/openaiFetch", () => ({ requestChatCompletion: vi.fn() }));
vi.mock("@/lib/ai/modelStore.server", () => ({ resolveAiModelFor: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/adminClient";
import { createAnonClient } from "@/lib/supabase/anonClient";
import { requestChatCompletion } from "@/lib/ai/openaiFetch";
import { resolveAiModelFor } from "@/lib/ai/modelStore.server";
import { buildTranslationSource } from "./shopTranslation";
import { applyShopTranslations, getVendorTranslation, hashTranslationSource, saveReviewedShopTranslation, syncShopTranslations } from "./shopTranslation.server";

const shop = { id: 1, vendorId: "vendor-1", name: "テスト店", products: [], rainPolicy: "outdoor", stallStyle: "手作りです" } as unknown as Shop;

describe("固定の選択肢と翻訳同期", () => {
  beforeEach(() => vi.resetAllMocks());

  it("選択肢だけが変わった店舗にはAI APIを呼ばない", async () => {
    const eq = vi.fn().mockResolvedValue({ data: [{ vendor_id: shop.vendorId, source_hash: hashTranslationSource("en", buildTranslationSource(shop)), status: "auto" }], error: null });
    const client = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) }) };
    vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);
    const result = await syncShopTranslations({ shops: [{ ...shop, rainPolicy: "cancel", paymentMethods: ["card"], stallStyleTags: ["試食あり"], schedule: "毎週日曜日" }], locale: "en", limit: 30 });
    expect(result).toEqual({ locale: "en", pending: 0, translated: 0, failed: 0 });
    expect(requestChatCompletion).not.toHaveBeenCalled();
  });
});

describe("saveReviewedShopTranslation", () => {
  beforeEach(() => vi.resetAllMocks());

  it("商品の読み込みに失敗したら、保存せずエラーにする（不完全な原文でハッシュを作らない）", async () => {
    const upsert = vi.fn();
    const from = vi.fn((table: string) => {
      if (table === "vendors") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { shop_name: "テスト店", strength: null, style: null, main_products: [], main_product_prices: {} }, error: null }) }) }) };
      }
      if (table === "products") return { select: () => ({ eq: async () => ({ data: null, error: { message: "boom" } }) }) };
      return { upsert };
    });
    vi.mocked(createAdminClient).mockReturnValue({ from } as unknown as ReturnType<typeof createAdminClient>);
    await expect(saveReviewedShopTranslation({ vendorId: "v1", locale: "en", translation: { name: "Test", strength: null, style: null, products: {} } })).rejects.toThrow(/products/);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("競合の保護", () => {
  beforeEach(() => vi.resetAllMocks());

  const vendorTables = (upsert: ReturnType<typeof vi.fn>, updatedAt: string) => (table: string) => {
    if (table === "vendors") {
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { shop_name: "テスト店", strength: null, style: null, main_products: [], main_product_prices: {}, updated_at: updatedAt }, error: null }) }) }) };
    }
    if (table === "products") return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
    return { upsert };
  };

  it("日本語を保存したあとにほかの人が日本語を変えていたら、一致しない印（stale:）で保存する", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createAdminClient).mockReturnValue({ from: vendorTables(upsert, "2026-10-06T00:00:01.000Z") } as unknown as ReturnType<typeof createAdminClient>);
    await saveReviewedShopTranslation({ vendorId: "v1", locale: "en", translation: { name: "Test", strength: null, style: null, products: {} }, expectedUpdatedAt: "2026-10-06T00:00:00.000Z" });
    expect(upsert.mock.calls[0][0].source_hash).toMatch(/^stale:/);
  });

  it("日本語が変わっていなければ、通常のハッシュで保存する", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createAdminClient).mockReturnValue({ from: vendorTables(upsert, "2026-10-06T00:00:00.000Z") } as unknown as ReturnType<typeof createAdminClient>);
    await saveReviewedShopTranslation({ vendorId: "v1", locale: "en", translation: { name: "Test", strength: null, style: null, products: {} }, expectedUpdatedAt: "2026-10-06T00:00:00.000Z" });
    expect(upsert.mock.calls[0][0].source_hash).not.toMatch(/^stale:/);
  });

  const arrangeSync = (existingRows: unknown[], updatedRows: unknown[]) => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    vi.mocked(resolveAiModelFor).mockResolvedValue({ def: { id: "m" } } as never);
    vi.mocked(requestChatCompletion).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ items: [{ key: "1", name: "Test", strength: null, style: null, products: [] }] }) } }] }),
    } as never);
    const eqHash = vi.fn().mockReturnValue({ select: async () => ({ data: updatedRows, error: null }) });
    const update = vi.fn().mockReturnValue({ eq: () => ({ eq: () => ({ eq: eqHash }) }) });
    const upsert = vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [], error: null }) });
    const client = { from: vi.fn(() => ({ select: () => ({ eq: async () => ({ data: existingRows, error: null }) }), update, upsert })) };
    vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);
    return { eqHash, update, upsert };
  };

  it("確認済みでも、日本語が変わって合わなくなった訳は、自動で訳し直す（読み取った時のハッシュの行だけ更新）", async () => {
    const { eqHash } = arrangeSync([{ vendor_id: shop.vendorId, source_hash: "old-hash", status: "reviewed" }], [{ vendor_id: shop.vendorId }]);
    const result = await syncShopTranslations({ shops: [shop], locale: "en", limit: 30 });
    expect(eqHash).toHaveBeenCalledWith("source_hash", "old-hash");
    expect(result.translated).toBe(1);
  });

  it("同期の途中で運営が保存して行が変わっていたら（更新が0行）、上書きしない", async () => {
    const { upsert } = arrangeSync([{ vendor_id: shop.vendorId, source_hash: "old-hash", status: "auto" }], []);
    const result = await syncShopTranslations({ shops: [shop], locale: "en", limit: 30 });
    expect(upsert).not.toHaveBeenCalled();
    expect(result.translated).toBe(0);
  });

  it("まだ訳が無い店は、重複なら何もしない形で作る", async () => {
    const { upsert } = arrangeSync([], []);
    await syncShopTranslations({ shops: [shop], locale: "en", limit: 30 });
    expect(upsert).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ ignoreDuplicates: true }));
  });
});

describe("日本語が空の項目の英語", () => {
  beforeEach(() => vi.resetAllMocks());

  it("ひとこと・出店スタイルの日本語が空なら、その英語は保存しない", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = (table: string) => {
      if (table === "vendors") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { shop_name: "テスト店", strength: "", style: null, main_products: [], main_product_prices: {}, updated_at: null }, error: null }) }) }) };
      }
      if (table === "products") return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
      return { upsert };
    };
    vi.mocked(createAdminClient).mockReturnValue({ from } as unknown as ReturnType<typeof createAdminClient>);
    await saveReviewedShopTranslation({ vendorId: "v1", locale: "en", translation: { name: "Test", strength: "old comment", style: "old style", products: {} } });
    expect(upsert.mock.calls[0][0]).toMatchObject({ name: "Test", strength: null, style: null });
  });
});

describe("getVendorTranslation の取得エラー", () => {
  beforeEach(() => vi.resetAllMocks());

  function clientReturning(error: { code?: string; message: string }) {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error });
    const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as unknown as ReturnType<typeof createAdminClient>);
  }

  it("DBの一時的なエラーは「英語版なし」にせず、例外にする", async () => {
    clientReturning({ code: "57014", message: "timeout" });
    await expect(getVendorTranslation("vendor-1", "en")).rejects.toThrow();
  });

  it("表が無いだけなら「英語版なし」", async () => {
    clientReturning({ code: "42P01", message: "missing" });
    await expect(getVendorTranslation("vendor-1", "en")).resolves.toBeNull();
  });
});

describe("カテゴリーの英語名", () => {
  beforeEach(() => vi.resetAllMocks());

  const withCategory = { ...shop, category: "食べ物" } as Shop;
  function stubAnon(categories: { data: unknown; error: unknown }) {
    const from = vi.fn((table: string) =>
      table === "categories"
        ? { select: () => ({ not: async () => categories }) }
        : { select: () => ({ eq: async () => ({ data: [], error: null }) }) }
    );
    vi.mocked(createAnonClient).mockReturnValue({ from } as unknown as ReturnType<typeof createAnonClient>);
  }

  it("英語では categoryEn を付け、日本語の category はそのまま残す", async () => {
    stubAnon({ data: [{ name: "食べ物", name_en: "Food" }], error: null });
    const [result] = await applyShopTranslations([withCategory, { ...withCategory, category: "工芸" } as Shop], "en");
    expect(result).toMatchObject({ category: "食べ物", categoryEn: "Food" });
    const [other] = (await applyShopTranslations([{ ...withCategory, category: "工芸" } as Shop], "en"));
    expect(other.categoryEn).toBeUndefined();
  });

  it("日本語では何も足さない。英語名の列が無い（42703）ときも日本語名のまま", async () => {
    stubAnon({ data: [{ name: "食べ物", name_en: "Food" }], error: null });
    expect((await applyShopTranslations([withCategory], "ja"))[0].categoryEn).toBeUndefined();
    stubAnon({ data: null, error: { code: "42703", message: "column does not exist" } });
    expect((await applyShopTranslations([withCategory], "en"))[0]).toMatchObject({ category: "食べ物" });
  });
});
