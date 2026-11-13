import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  summarizeShops,
  sortShopIdsByDistance,
  fetchCandidateVendorIds,
  fetchShopsByVendorIds,
} from "./vendorSearch";
import type { Shop } from "@/app/(public)/map/data/shops";

// 公開設定と地図の配置は、テストごとに切り替える。既定は旧番号（店番）の経路
const publicState = vi.hoisted(() => ({
  enabled: false,
  placed: [] as Array<{ id: number; vendorId: string; position: number; lat: number; lng: number; chome: string | null }>,
}));
vi.mock("@/lib/market-schedule/rollout.server", () => ({ readPublicScheduleRollout: async () => publicState.enabled }));
vi.mock("@/app/(public)/map/services/shopCache", () => ({
  fetchPublicShopData: async () => ({ shops: publicState.placed, profiles: [] }),
}));

/** テーブル名・RPC名ごとに決まった行を返す supabase の代役。絞り込み条件は見ない */
function fakeSupabase(
  tables: Record<string, unknown[]>,
  rpcs: Record<string, unknown[]> = {}
) {
  const query = (data: unknown[]) => {
    const q: Record<string, unknown> = {};
    for (const method of ["select", "in", "eq", "gt", "order", "ilike", "or", "limit", "returns"]) {
      q[method] = () => q;
    }
    q.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data, error: null });
    return q;
  };
  return {
    from: (table: string) => query(tables[table] ?? []),
    rpc: (name: string) => query(rpcs[name] ?? []),
  } as unknown as SupabaseClient<Database>;
}

const makeShop = (overrides: Partial<Shop> & { id: number }): Shop => ({
  vendorId: `vendor-${overrides.id}`,
  name: `店舗${overrides.id}`,
  ownerName: "",
  category: "野菜",
  products: [],
  description: "",
  position: overrides.id,
  lat: 33.565,
  lng: 133.531,
  schedule: "",
  paymentMethods: [],
  ...overrides,
});

describe("summarizeShops", () => {
  it("空配列は '該当なし' を返す", () => {
    expect(summarizeShops([])).toBe("該当なし");
  });

  it("店舗情報を1行ずつ返す", () => {
    const shops = [makeShop({ id: 1, name: "山田青果", category: "野菜", products: ["トマト", "きゅうり"] })];
    const result = summarizeShops(shops);
    expect(result).toContain("id:1");
    expect(result).toContain("name:山田青果");
    expect(result).toContain("category:野菜");
    expect(result).toContain("products:トマト / きゅうり");
  });

  it("6件を超える場合は最初の6件のみ返す（デフォルト上限）", () => {
    const shops = Array.from({ length: 10 }, (_, i) => makeShop({ id: i + 1 }));
    const result = summarizeShops(shops);
    const lines = result.split("\n");
    expect(lines.length).toBe(6);
  });

  it("limit を渡すとその件数まで返す（おさんぽプランのベクトル候補10件など）", () => {
    const shops = Array.from({ length: 12 }, (_, i) => makeShop({ id: i + 1 }));
    const result = summarizeShops(shops, 10);
    const lines = result.split("\n");
    expect(lines.length).toBe(10);
    expect(lines[9]).toContain("id:10");
  });

  it("shopStrengthがあれば含む", () => {
    const shops = [makeShop({ id: 1, shopStrength: "新鮮な朝採り野菜" })];
    expect(summarizeShops(shops)).toContain("strength:新鮮な朝採り野菜");
  });

  it("scheduleがあれば含む", () => {
    const shops = [makeShop({ id: 1, schedule: "毎週日曜" })];
    expect(summarizeShops(shops)).toContain("schedule:毎週日曜");
  });
});

describe("sortShopIdsByDistance", () => {
  const shops = [
    makeShop({ id: 1, lat: 33.565, lng: 133.531 }),
    makeShop({ id: 2, lat: 33.570, lng: 133.535 }),
    makeShop({ id: 3, lat: 33.560, lng: 133.528 }),
  ];

  it("locationがnullのときは元の順序を返す", () => {
    expect(sortShopIdsByDistance([1, 2, 3], shops, null)).toEqual([1, 2, 3]);
  });

  it("近い店舗から順に並び替える", () => {
    const location = { lat: 33.565, lng: 133.531 }; // id:1 と同じ座標
    const sorted = sortShopIdsByDistance([1, 2, 3], shops, location);
    expect(sorted[0]).toBe(1);
  });

  it("shop一覧に存在しないidはInfinityとして末尾になる", () => {
    const location = { lat: 33.565, lng: 133.531 };
    const sorted = sortShopIdsByDistance([999, 1], shops, location);
    expect(sorted[sorted.length - 1]).toBe(999);
  });

  it("空配列は空配列を返す", () => {
    expect(sortShopIdsByDistance([], shops, { lat: 33.565, lng: 133.531 })).toEqual([]);
  });
});

// 店の候補が関連度順でなく店番順になっていた（#862）
describe("fetchCandidateVendorIds", () => {
  it("季節の候補で上限が埋まっても、ベクトル検索で意味の近い店を先頭に残す", async () => {
    const seasonalVendorIds = Array.from({ length: 12 }, (_, i) => `seasonal-${i}`);
    const supabase = fakeSupabase(
      {},
      {
        match_vendor_embeddings: [
          { vendor_id: "vector-best", similarity: 0.8 },
          { vendor_id: "vector-second", similarity: 0.6 },
        ],
      }
    );

    const ids = await fetchCandidateVendorIds(supabase, [], null, [0.1], seasonalVendorIds);

    expect(ids.slice(0, 2)).toEqual(["vector-best", "vector-second"]);
    expect(ids).toHaveLength(12);
  });

  it("ベクトル検索と重なる季節・キーワードの店は二重に数えない", async () => {
    const supabase = fakeSupabase(
      { vendors: [{ id: "keyword-1" }, { id: "vector-best" }] },
      { match_vendor_embeddings: [{ vendor_id: "vector-best", similarity: 0.8 }] }
    );

    const ids = await fetchCandidateVendorIds(supabase, ["野菜"], null, [0.1], ["vector-best", "seasonal-1"]);

    expect(ids[0]).toBe("vector-best");
    expect(ids.filter((id) => id === "vector-best")).toHaveLength(1);
    expect(ids).toEqual(expect.arrayContaining(["seasonal-1", "keyword-1"]));
  });
});

describe("fetchShopsByVendorIds", () => {
  it("店番順に並べ替えず、渡された vendorIds の順（関連度順）で返す", async () => {
    const supabase = fakeSupabase({
      vendors: [
        { id: "v-small", shop_name: "店番の小さい店" },
        { id: "v-large", shop_name: "意味の近い店" },
      ],
      location_assignments: [
        { vendor_id: "v-small", location_id: "loc-5", market_date: "2026-11-01" },
        { vendor_id: "v-large", location_id: "loc-300", market_date: "2026-11-01" },
      ],
      market_locations: [
        { id: "loc-5", store_number: 5, latitude: 33.56, longitude: 133.53, district: "1丁目" },
        { id: "loc-300", store_number: 300, latitude: 33.56, longitude: 133.53, district: "5丁目" },
      ],
    });

    const shops = await fetchShopsByVendorIds(supabase, ["v-large", "v-small"]);

    expect(shops.map((shop) => shop.id)).toEqual([300, 5]);
  });
});

describe("fetchShopsByVendorIds（公開切り替え後）", () => {
  it("地図に配置されている店舗だけを、地図と同じ固定 ID・位置で返す", async () => {
    publicState.enabled = true;
    publicState.placed = [
      { id: 1001, vendorId: "v-placed", position: 7, lat: 33.6, lng: 133.6, chome: "1丁目" },
    ];
    try {
      const supabase = fakeSupabase({
        vendors: [
          { id: "v-placed", shop_name: "配置済み", public_shop_id: 1001 },
          { id: "v-unplaced", shop_name: "配置なし", public_shop_id: 1002 },
        ],
        // 旧配置が残っていても、地図に出ていない店舗は候補にしない
        location_assignments: [
          { vendor_id: "v-unplaced", location_id: "loc-9", market_date: "2026-11-01" },
        ],
        market_locations: [
          { id: "loc-9", store_number: 9, latitude: 33.5, longitude: 133.5, district: "2丁目" },
        ],
      });
      const shops = await fetchShopsByVendorIds(supabase, ["v-unplaced", "v-placed"]);
      expect(shops.map((shop) => shop.id)).toEqual([1001]);
      expect(shops[0]).toMatchObject({ lat: 33.6, lng: 133.6, position: 7 });
    } finally {
      publicState.enabled = false;
      publicState.placed = [];
    }
  });
});
