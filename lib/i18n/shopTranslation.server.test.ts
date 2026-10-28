import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Shop } from "@/app/(public)/map/types/shopData";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn() }));
vi.mock("@/lib/supabase/anonClient", () => ({ createAnonClient: vi.fn() }));
vi.mock("@/lib/supabase/adminClient", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/ai/openaiFetch", () => ({ requestChatCompletion: vi.fn() }));
vi.mock("@/lib/ai/modelStore.server", () => ({ resolveAiModelFor: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/adminClient";
import { requestChatCompletion } from "@/lib/ai/openaiFetch";
import { buildTranslationSource } from "./shopTranslation";
import { hashTranslationSource, syncShopTranslations } from "./shopTranslation.server";

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
