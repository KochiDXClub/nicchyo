import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_ROUTE_CONFIG } from "@/app/(public)/map/types/mapRoute";
import {
  hasRoadPositionSchema,
  isRouteConfigChanged,
  loadVendorDeletionTargets,
  planSlotRoadPositions,
  selectRepositionedShops,
  validateVendorDeletionDraft,
  validateVendorDrafts,
  type EditableShop,
  type EditableVendor,
} from "./_shared";

describe("isRouteConfigChanged", () => {
  it("同じ値なら変更なし", () => {
    expect(isRouteConfigChanged(DEFAULT_MAP_ROUTE_CONFIG, { ...DEFAULT_MAP_ROUTE_CONFIG })).toBe(false);
  });

  it.each([
    ["roadHalfWidthMeters", { roadHalfWidthMeters: 20 }],
    ["snapDistanceMeters", { snapDistanceMeters: 10 }],
    ["visibleDistanceMeters", { visibleDistanceMeters: 60 }],
    ["key", { key: "other" }],
  ] as const)("%s が変わっていれば変更あり", (_label, patch) => {
    expect(isRouteConfigChanged(DEFAULT_MAP_ROUTE_CONFIG, { ...DEFAULT_MAP_ROUTE_CONFIG, ...patch })).toBe(
      true
    );
  });
});

describe("planSlotRoadPositions", () => {
  const road = {
    id: "r1",
    name: "テスト通り",
    kind: "market" as const,
    widthMeters: 36,
    points: [
      { id: "p0", lat: 33.56141, lng: 133.53, order: 0, roadId: "r1" },
      { id: "p1", lat: 33.56141, lng: 133.533, order: 1, roadId: "r1" },
    ],
  };
  const shop = (position: number, lat: number, lng: number, extra: Partial<EditableShop> = {}): EditableShop => ({
    locationId: `loc-${position}`,
    id: position,
    position,
    name: `店${position}`,
    lat,
    lng,
    ...extra,
  });

  it("道の近くの区画は道基準の位置に変換し、遠い区画は変換せずに報告する", () => {
    const plan = planSlotRoadPositions(
      [shop(1, 33.56148, 133.531), shop(2, 33.56134, 133.531), shop(3, 33.5625, 133.531)],
      [road],
      18
    );
    expect(plan.matched.map((m) => [m.position, m.roadSide])).toEqual([
      [1, "left"],
      [2, "right"],
    ]);
    expect(plan.matched[0].roadOffsetM).toBeCloseTo(7.7, 0);
    expect(plan.unmatched).toEqual([
      expect.objectContaining({ position: 3, nearestRoadName: "テスト通り" }),
    ]);
    expect(plan.unmatched[0].distanceToNearestRoadM).toBeGreaterThan(100);
  });

  it("すでに道基準の位置を持つ区画は対象にしない", () => {
    const anchored = shop(1, 33.56148, 133.531, { roadId: "r1", roadDistanceM: 90, roadSide: "left", roadOffsetM: 7 });
    const plan = planSlotRoadPositions([anchored], [road], 18);
    expect(plan.matched).toEqual([]);
    expect(plan.unmatched).toEqual([]);
  });

  it("道が1本も無ければすべて報告に回す", () => {
    const plan = planSlotRoadPositions([shop(1, 33.56148, 133.531)], [], 18);
    expect(plan.unmatched).toEqual([expect.objectContaining({ position: 1, nearestRoadName: null, distanceToNearestRoadM: null })]);
  });
});

describe("validateVendorDrafts", () => {
  const stored: EditableVendor = { id: "v1", name: "既存の店", categoryId: null, strength: "", mainProducts: ["柚子"] };
  const context = { existingVendors: new Map([["v1", stored]]), categoryIds: new Set(["c1"]) };
  const draft = (patch: Partial<EditableVendor> = {}): EditableVendor => ({
    id: "new-vendor-1",
    name: "朝市の八百屋",
    categoryId: "c1",
    strength: "",
    mainProducts: ["柚子"],
    ...patch,
  });

  it("新しい出店者と既存の出店者の正しい入力は通す", () => {
    expect(validateVendorDrafts([draft(), draft({ id: "v1", categoryId: null })], context)).toBeNull();
  });

  it.each([
    ["存在しない既存の出店者", draft({ id: "v-unknown" }), "存在しない出店者"],
    ["店名が空", draft({ name: "  " }), "店名を入れてください"],
    ["店名が長すぎる", draft({ name: "あ".repeat(61) }), "60 文字以内"],
    ["存在しないジャンル", draft({ categoryId: "c-unknown" }), "ジャンル"],
    ["こだわりが長すぎる", draft({ strength: "あ".repeat(401) }), "こだわり"],
    ["主な商品が多すぎる", draft({ mainProducts: Array.from({ length: 11 }, (_, i) => `品${i}`) }), "主な商品"],
    ["主な商品に空の項目", draft({ mainProducts: [" "] }), "主な商品"],
  ])("%s は理由を返す", (_label, vendor, message) => {
    expect(validateVendorDrafts([vendor], context)).toContain(message);
  });

  it("同じ出店者が2回送られてきたら拒否する", () => {
    expect(validateVendorDrafts([draft(), draft()], context)).toContain("正しくありません");
  });

  it("既存の出店者は、DB の値から変わっていない項目なら上限を超えていても通す（店名だけ直した保存を止めない）", () => {
    const overLimit: EditableVendor = {
      ...stored,
      strength: "あ".repeat(500),
      mainProducts: Array.from({ length: 12 }, (_, i) => `品${i}`),
    };
    const ctx = { existingVendors: new Map([["v1", overLimit]]), categoryIds: new Set(["c1"]) };
    expect(validateVendorDrafts([{ ...overLimit, name: "名前を直した店" }], ctx)).toBeNull();
  });

  it("既存の出店者でも、変えた項目が上限を超えていれば拒否する", () => {
    const overLimit: EditableVendor = { ...stored, mainProducts: Array.from({ length: 12 }, (_, i) => `品${i}`) };
    const ctx = { existingVendors: new Map([["v1", overLimit]]), categoryIds: new Set(["c1"]) };
    expect(validateVendorDrafts([{ ...overLimit, mainProducts: [...overLimit.mainProducts, "もう1つ"] }], ctx)).toContain("主な商品");
    expect(validateVendorDrafts([{ ...overLimit, name: "あ".repeat(61) }], ctx)).toContain("60 文字以内");
  });

  it("既存の出店者の店名を空にする変更は拒否する", () => {
    expect(validateVendorDrafts([{ ...stored, name: " " }], context)).toContain("店名を入れてください");
  });
});

describe("selectRepositionedShops", () => {
  const point = (id: string, lat: number, lng: number, order: number) => ({ id, lat, lng, order, roadId: "r1" });
  const road = (lat: number) => ({
    id: "r1",
    name: "テスト通り",
    kind: "market" as const,
    widthMeters: 20,
    points: [point("p0", lat, 133.53, 0), point("p1", lat, 133.533, 1)],
  });
  // 移行は緯度経度を変えずに道基準の位置だけを入れるので、道から計算した位置は元と少しずれる
  const shop = (id: string, lat: number): EditableShop => ({
    locationId: id,
    id: 1,
    position: 1,
    name: "空き",
    lat,
    lng: 133.531,
    roadId: "r1",
    roadDistanceM: 50,
    roadSide: "left",
    roadOffsetM: 8,
  });
  const current = shop("loc-1", 33.56141);
  const moved = { ...current, lat: 33.561412 };

  it("道の点が変わっていなければ、位置が少しずれていても計算し直さない", () => {
    expect(
      selectRepositionedShops({
        shopsAfterSave: [moved],
        currentShops: [current],
        currentRoads: [road(33.5614)],
        roadsAfterSave: [road(33.5614)],
        writtenLocationIds: new Set(),
      })
    ).toEqual([]);
  });

  it("道の点が変わったときは、その道の区画を計算し直す", () => {
    expect(
      selectRepositionedShops({
        shopsAfterSave: [moved],
        currentShops: [current],
        currentRoads: [road(33.5614)],
        roadsAfterSave: [road(33.5615)],
        writtenLocationIds: new Set(),
      }).map((s) => s.locationId)
    ).toEqual(["loc-1"]);
  });

  it("送られてきた区画は含めない", () => {
    expect(
      selectRepositionedShops({
        shopsAfterSave: [moved],
        currentShops: [current],
        currentRoads: [road(33.5614)],
        roadsAfterSave: [road(33.5615)],
        writtenLocationIds: new Set(["loc-1"]),
      })
    ).toEqual([]);
  });

  it("新しくできた道に乗る区画は計算し直す", () => {
    expect(
      selectRepositionedShops({
        shopsAfterSave: [moved],
        currentShops: [current],
        currentRoads: [],
        roadsAfterSave: [road(33.5614)],
        writtenLocationIds: new Set(),
      }).length
    ).toBe(1);
  });
});

describe("hasRoadPositionSchema", () => {
  const clientReturning = (error: { code: string } | null) =>
    ({
      from: () => ({ select: () => ({ limit: async () => ({ data: [], error }) }) }),
    }) as unknown as Parameters<typeof hasRoadPositionSchema>[0];

  it("道基準の位置の列があれば true", async () => {
    await expect(hasRoadPositionSchema(clientReturning(null))).resolves.toBe(true);
  });

  it("列が無い（マイグレーション前）なら false", async () => {
    await expect(hasRoadPositionSchema(clientReturning({ code: "42703" }))).resolves.toBe(false);
  });

  it("それ以外のエラーは握りつぶさずに投げる", async () => {
    await expect(hasRoadPositionSchema(clientReturning({ code: "08006" }))).rejects.toThrow();
  });
});

describe("validateVendorDeletionDraft", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  const none = { assignedVendorIds: new Set<string>(), upsertVendorIds: new Set<string>() };

  it("区画に残らない出店者の id なら通る", () => {
    expect(validateVendorDeletionDraft([A, B], none)).toBeNull();
  });

  it("配列でない・id が文字列でない・uuid でない・重複している場合は断る", () => {
    expect(validateVendorDeletionDraft("x", none)).not.toBeNull();
    expect(validateVendorDeletionDraft([1], none)).not.toBeNull();
    expect(validateVendorDeletionDraft(["not-a-uuid"], none)).not.toBeNull();
    expect(validateVendorDeletionDraft(["new-vendor-1"], none)).not.toBeNull();
    expect(validateVendorDeletionDraft([A, A], none)).not.toBeNull();
  });

  it("保存後も区画に割り当てられている出店者は消せない", () => {
    expect(validateVendorDeletionDraft([A], { ...none, assignedVendorIds: new Set([A]) })).toContain("区画に割り当てられている");
  });

  it("同じ保存で更新する出店者は消せない", () => {
    expect(validateVendorDeletionDraft([A], { ...none, upsertVendorIds: new Set([A]) })).toContain("更新する出店者");
  });

  it("1回の保存で削除できる件数に上限がある", () => {
    const many = Array.from({ length: 501 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    expect(validateVendorDeletionDraft(many, none)).toContain("500");
  });
});

describe("loadVendorDeletionTargets", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  const C = "33333333-3333-4333-8333-333333333333";

  // from(テーブル).select(...).in(...) に、テーブルごとの結果を返す管理用クライアントの代役
  function fakeClient(tables: Record<string, { data?: unknown[]; error?: unknown }>) {
    const queried: string[] = [];
    const client = {
      from: (table: string) => {
        queried.push(table);
        return { select: () => ({ in: async () => ({ data: tables[table]?.data ?? [], error: tables[table]?.error ?? null }) }) };
      },
    };
    return { client: client as never, queried };
  }

  it("アカウントに紐づく出店者と、ほかの区画に割り当てが残る出店者を見つける", async () => {
    const { client, queried } = fakeClient({
      vendors: { data: [{ id: A, shop_name: " 店A " }, { id: B, shop_name: "店B" }, { id: C, shop_name: null }] },
      shop_members: { data: [{ vendor_id: B }, { vendor_id: B }] },
      location_assignments: {
        data: [
          { vendor_id: A, location_id: "gone" }, // この保存で消える区画への割り当て → 問題なし
          { vendor_id: C, location_id: "other" }, // ほかの区画に残っている
        ],
      },
    });
    const result = await loadVendorDeletionTargets(client, [A, B, C], ["gone"]);
    expect(result).toEqual({
      existing: [{ id: A, name: "店A" }, { id: B, name: "店B" }, { id: C, name: "" }],
      withMembers: [B],
      assignedElsewhere: [C],
      error: false,
    });
    expect(queried.sort()).toEqual(["location_assignments", "shop_members", "vendors"]);
  });

  it("id が空なら DB を見ない", async () => {
    const { client, queried } = fakeClient({});
    expect(await loadVendorDeletionTargets(client, [], [])).toMatchObject({ existing: [], error: false });
    expect(queried).toEqual([]);
  });

  it("どれかの読み取りに失敗したら error にして、削除に進ませない", async () => {
    const { client } = fakeClient({ shop_members: { error: { message: "boom" } } });
    expect(await loadVendorDeletionTargets(client, [A], [])).toMatchObject({ error: true, withMembers: [] });
  });
});
