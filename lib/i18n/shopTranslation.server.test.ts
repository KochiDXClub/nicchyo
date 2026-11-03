import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Shop } from "@/app/(public)/map/types/shopData";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn() }));
vi.mock("@/lib/supabase/anonClient", () => ({ createAnonClient: vi.fn() }));
vi.mock("@/lib/supabase/adminClient", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/ai/openaiFetch", () => ({ requestChatCompletion: vi.fn() }));
vi.mock("@/lib/ai/modelStore.server", () => ({ resolveAiModelFor: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/adminClient";
import { requestChatCompletion } from "@/lib/ai/openaiFetch";
import { resolveAiModelFor } from "@/lib/ai/modelStore.server";
import { buildTranslationSource } from "./shopTranslation";
import { hashTranslationSource, saveReviewedShopTranslation, syncShopTranslations } from "./shopTranslation.server";

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

  it("同期の途中で reviewed になった行は、自動訳で上書きしない", async () => {
    vi.stubEnv("OPENAI_API_KEY", "k");
    vi.mocked(resolveAiModelFor).mockResolvedValue({ def: { id: "m" } } as never);
    vi.mocked(requestChatCompletion).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ items: [{ key: "1", name: "Test", strength: null, style: null, products: [] }] }) } }] }),
    } as never);
    const neq = vi.fn().mockReturnValue({ select: async () => ({ data: [], error: null }) });
    const upsertSelect = vi.fn().mockResolvedValue({ data: [], error: null });
    const update = vi.fn().mockReturnValue({ eq: () => ({ eq: () => ({ neq }) }) });
    const upsert = vi.fn().mockReturnValue({ select: upsertSelect });
    const client = {
      from: vi.fn(() => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }), update, upsert })),
    };
    vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);
    const result = await syncShopTranslations({ shops: [shop], locale: "en", limit: 30 });
    expect(neq).toHaveBeenCalledWith("status", "reviewed");
    expect(upsert).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ ignoreDuplicates: true }));
    expect(result.translated).toBe(0);
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
