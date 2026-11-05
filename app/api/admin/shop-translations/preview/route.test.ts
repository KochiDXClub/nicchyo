import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/shopApiGuard", () => ({ guardAdminWrite: vi.fn() }));
vi.mock("@/lib/i18n/shopTranslation.server", () => ({ previewShopTranslation: vi.fn() }));

import { guardAdminWrite } from "@/lib/admin/shopApiGuard";
import { previewShopTranslation } from "@/lib/i18n/shopTranslation.server";
import { POST } from "./route";

const request = new Request("http://localhost/api/admin/shop-translations/preview", { method: "POST" });

describe("POST /api/admin/shop-translations/preview", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });

  it("ガードで弾かれたらそのまま返す", async () => {
    vi.mocked(guardAdminWrite).mockResolvedValue({ error: new Response(null, { status: 403 }) } as never);
    const res = await POST(request);
    expect(res.status).toBe(403);
    expect(previewShopTranslation).not.toHaveBeenCalled();
  });

  it("原文が空なら400でAIを呼ばない", async () => {
    vi.mocked(guardAdminWrite).mockResolvedValue({ body: { name: "", products: [] } } as never);
    const res = await POST(request);
    expect(res.status).toBe(400);
    expect(previewShopTranslation).not.toHaveBeenCalled();
  });

  it("APIキーが無ければ503", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.mocked(guardAdminWrite).mockResolvedValue({ body: { name: "山田商店" } } as never);
    expect((await POST(request)).status).toBe(503);
  });

  it("訳を返す（保存はしない）", async () => {
    vi.mocked(guardAdminWrite).mockResolvedValue({ body: { name: "山田商店", products: ["大根"] } } as never);
    vi.mocked(previewShopTranslation).mockResolvedValue({ translation: { name: "Yamada Shoten", strength: null, style: null, products: { 大根: "Radish" } }, model: "m" });
    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, name: "Yamada Shoten", products: { 大根: "Radish" } });
    expect(previewShopTranslation).toHaveBeenCalledWith({ name: "山田商店", strength: "", style: "", products: ["大根"] }, "en");
  });

  it("AIの結果が読めなければ502", async () => {
    vi.mocked(guardAdminWrite).mockResolvedValue({ body: { name: "山田商店" } } as never);
    vi.mocked(previewShopTranslation).mockResolvedValue(null);
    expect((await POST(request)).status).toBe(502);
  });
});
