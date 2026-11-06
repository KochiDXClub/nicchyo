import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/requireAdminApi", () => ({ requireAdminApi: auth }));
import { GET } from "./route";
const vendorId = "11111111-1111-4111-8111-111111111111";
const locationId = "22222222-2222-4222-8222-222222222222";

type Result = { data: unknown; error: { message: string } | null };
function mockClient(legacyError = false) {
  const order = vi.fn();
  const client = { from: vi.fn((table: string) => {
    let filtered = false;
    const result = (): Result => {
      if (table === "market_locations") return { data: [{ id: locationId, store_number: 183, latitude: 33.56, longitude: 133.53, district: "三丁目" }], error: null };
      if (table === "vendors") return { data: [{ id: vendorId, shop_name: "店" }], error: null };
      if (table === "field_shop_locations") return { data: { store_number: 20, latitude: 33.55, longitude: 133.52, accuracy_m: 10, source: "gps" }, error: null };
      return filtered ? (legacyError ? { data: null, error: { message: "failed" } } : { data: { location_id: locationId, market_date: "2026-11-01" }, error: null }) : { data: [], error: null };
    };
    const query = {
      select: () => query,
      eq: () => { filtered = true; return query; },
      order: (column: string) => { order(column); return query; },
      limit: () => query,
      maybeSingle: async () => result(),
      then: (resolve: (value: Result) => void) => Promise.resolve(result()).then(resolve),
    };
    return query;
  }) };
  return { client, order };
}
const params = { params: Promise.resolve({ id: vendorId }) };
beforeEach(() => vi.clearAllMocks());
describe("旧配置と現場記録", () => {
  it("現場記録と旧配置を分けて返し、旧配置は日付順で取得する", async () => {
    const { client, order } = mockClient(); auth.mockResolvedValue({ adminClient: client });
    const response = await GET(new Request("https://example.test"), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ current: { storeNumber: 20, recorded: true }, legacyPlacement: { storeNumber: 183, district: "三丁目", marketDate: "2026-11-01" } });
    expect(order.mock.calls.map((call) => call[0])).toEqual(["market_date", "created_at", "id"]);
  });
  it("旧配置を取得できないときは未登録と偽らない", async () => {
    const { client } = mockClient(true); auth.mockResolvedValue({ adminClient: client });
    expect((await GET(new Request("https://example.test"), params)).status).toBe(500);
  });
  it("認可されないときは問い合わせない", async () => {
    auth.mockResolvedValue({ error: NextResponse.json({ error: "forbidden" }, { status: 403 }) });
    expect((await GET(new Request("https://example.test"), params)).status).toBe(403);
  });
});
