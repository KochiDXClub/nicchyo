import { beforeEach, describe, expect, it, vi } from "vitest";
const enabled = vi.hoisted(() => vi.fn());
const rows = vi.hoisted(() => vi.fn());
const fetchRows = vi.hoisted(() => vi.fn());
vi.mock("@/lib/market-schedule/rollout.server", () => ({ readPublicScheduleRollout: enabled }));
vi.mock("@/lib/market-schedule/read.server", () => ({ readScheduleRows: rows }));
vi.mock("@/lib/supabase/fetchAllRows", () => ({ fetchAllRows: fetchRows }));
vi.mock("@/lib/supabase/adminClient", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/supabase/anonClient", () => ({ createAnonClient: () => ({}) }));
import { readPublicLegacyIdentities } from "./publicIdentity.server";
beforeEach(() => { vi.clearAllMocks(); enabled.mockResolvedValue(true); rows.mockImplementation(async (_db: unknown, table: string) => table === "legacy_shop_identity_revocations" ? [{ legacy_shop_id: 4 }] : [{ legacy_shop_id: 1, vendor_id: "visible" }, { legacy_shop_id: 2, vendor_id: "hidden" }, { legacy_shop_id: 3, vendor_id: null }, { legacy_shop_id: 4, vendor_id: "visible" }]); fetchRows.mockResolvedValue({ data: [{ id: "visible", public_shop_id: 1001 }], error: null }); });
describe("旧番号の公開解決", () => {
  it("公開可能かつ確認済みの店舗だけを返す", async () => {
    expect(await readPublicLegacyIdentities()).toEqual({ enabled: true, aliases: { "1": 1001 } });
  });
  it("切り替え前は旧番号のまま扱う", async () => {
    enabled.mockResolvedValue(false);
    expect(await readPublicLegacyIdentities()).toEqual({ enabled: false, aliases: {} });
    expect(rows).not.toHaveBeenCalled();
  });
  it("公開状態の取得に失敗したら対応を推測しない", async () => {
    fetchRows.mockResolvedValue({ data: null, error: { message: "failed" } });
    await expect(readPublicLegacyIdentities()).rejects.toThrow();
  });
});
