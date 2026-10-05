import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const guard = vi.fn();
const logAdminAudit = vi.fn();
const revalidate = vi.fn();
const updateCalls: { values: Record<string, unknown>; filters: [string, unknown][] }[] = [];
const upsertOwner = vi.fn();
let current: Record<string, unknown>;
let updateRows: { id: string }[];

vi.mock("@/lib/admin/shopApiGuard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/shopApiGuard")>()),
  guardAdminShopWrite: (...args: unknown[]) => guard(...args),
}));
vi.mock("@/lib/auth/requireAdminApi", () => ({ requireAdminApi: vi.fn() }));
vi.mock("@/lib/audit/logAdminAudit", () => ({ logAdminAudit: (...args: unknown[]) => logAdminAudit(...args) }));
vi.mock("@/app/(public)/map/services/shopCache", () => ({ revalidatePublicShops: () => revalidate() }));

import { PATCH } from "./route";

const ID = "00000000-0000-4000-8000-00000000000a";
const LOADED_AT = "2026-10-04T01:00:00+00:00";

function patch(body: unknown) {
  return PATCH(
    new Request(`https://nicchyo.example/api/admin/shops/${ID}`, { method: "PATCH", body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: ID }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  // 2026-10-11 06:00 JST（UTC ではまだ 10/10）
  vi.setSystemTime(new Date("2026-10-10T21:00:00Z"));
  updateCalls.length = 0;
  current = { shop_name: "山田農園", listing_status: "pending", listing_consented_on: null, business_hours_start: null, business_hours_end: null, updated_at: LOADED_AT };
  updateRows = [{ id: ID }];
  upsertOwner.mockResolvedValue({ error: null });
  logAdminAudit.mockResolvedValue(undefined);

  const adminClient = {
    from: (table: string) => {
      if (table === "vendor_owner_profiles") return { upsert: (...args: unknown[]) => upsertOwner(...args) };
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: current, error: null }) }) }),
        update: (values: Record<string, unknown>) => {
          const call = { values, filters: [] as [string, unknown][] };
          updateCalls.push(call);
          const chain = {
            eq: (column: string, value: unknown) => (call.filters.push([column, value]), chain),
            is: (column: string, value: unknown) => (call.filters.push([`${column} is`, value]), chain),
            select: async () => ({ data: updateRows, error: null }),
          };
          return chain;
        },
      };
    },
  };
  guard.mockResolvedValue({ ctx: { user: { id: "admin-1", email: "a@example.com" }, role: "admin", adminClient, ip: null } });
});

afterEach(() => vi.useRealTimers());

describe("PATCH /api/admin/shops/[id]", () => {
  it("updated_at が送られていなければ 400（同時編集の確認を飛ばさせない）", async () => {
    const res = await patch({ shop_name: "新しい名前" });
    expect(res.status).toBe(400);
    expect(updateCalls).toHaveLength(0);
  });

  it("開いたあとに更新されていたら 409 で、何も書かない（店主名だけの更新も同じ）", async () => {
    const stale = "2026-10-03T00:00:00+00:00";
    expect((await patch({ shop_name: "新しい名前", updated_at: stale })).status).toBe(409);
    expect((await patch({ owner_name: "山田太郎", updated_at: stale })).status).toBe(409);
    expect(updateCalls).toHaveLength(0);
    expect(upsertOwner).not.toHaveBeenCalled();
  });

  it("一致していれば、updated_at を条件に更新する。同じ時刻の別の表記でも一致とみなす", async () => {
    const res = await patch({ shop_name: "新しい名前", updated_at: "2026-10-04T01:00:00Z" });
    expect(res.status).toBe(200);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].filters).toContainEqual(["updated_at", LOADED_AT]);
    expect(updateCalls[0].values.shop_name).toBe("新しい名前");
    expect(revalidate).toHaveBeenCalled();
  });

  it("確認のあと更新までの間に別の人が書いたら（0 行）409", async () => {
    updateRows = [];
    expect((await patch({ shop_name: "新しい名前", updated_at: LOADED_AT })).status).toBe(409);
  });

  it("店主名だけの更新も、updated_at を進めて確認を通す", async () => {
    const res = await patch({ owner_name: "山田太郎", updated_at: LOADED_AT });
    expect(res.status).toBe(200);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].filters).toContainEqual(["updated_at", LOADED_AT]);
    expect(upsertOwner).toHaveBeenCalled();
  });

  it("まだ一度も更新されていない店舗（updated_at が null）は null を送る", async () => {
    current.updated_at = null;
    expect((await patch({ shop_name: "新しい名前", updated_at: null })).status).toBe(200);
    expect(updateCalls[0].filters).toContainEqual(["updated_at is", null]);
  });

  it("許可済みにすると、許可日が日本時間の今日で入る（UTC の前日ではない）。記録済みなら上書きしない", async () => {
    await patch({ listing_status: "allowed", updated_at: LOADED_AT });
    expect(updateCalls[0].values.listing_consented_on).toBe("2026-10-11");

    updateCalls.length = 0;
    current.listing_consented_on = "2026-10-04";
    await patch({ listing_status: "allowed", updated_at: LOADED_AT });
    expect(updateCalls[0].values.listing_consented_on).toBeUndefined();
  });

  it("管理者でなければ何もしない", async () => {
    guard.mockResolvedValue({ error: new Response(null, { status: 401 }) });
    expect((await patch({ shop_name: "x", updated_at: LOADED_AT })).status).toBe(401);
    expect(updateCalls).toHaveLength(0);
  });
});
