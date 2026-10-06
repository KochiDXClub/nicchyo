import { describe, expect, it } from "vitest";
import { latToMeters } from "../../map/utils/mapRouteGeometry";
import { defaultImportRoads, normalizeChome, parseStoreCsv, planStoreImport, STORE_CSV_HEADERS } from "./storeCsvImport";
import type { EditableRoad, EditableShop, EditableVendor } from "./types";

// 西 → 東へ描いた追手筋と、北 → 南へ描いた大橋通り
const otesuji: EditableRoad = {
  id: "main",
  name: "追手筋",
  kind: "market",
  widthMeters: 36,
  points: [
    { id: "a", lat: 33.5614, lng: 133.53, order: 0, roadId: "main" },
    { id: "b", lat: 33.5614, lng: 133.54, order: 1, roadId: "main" },
  ],
};
const ohashi: EditableRoad = {
  id: "ohashi",
  name: "大橋通り",
  kind: "market",
  widthMeters: 20,
  points: [
    { id: "c", lat: 33.5625, lng: 133.545, order: 0, roadId: "ohashi" },
    { id: "d", lat: 33.5600, lng: 133.545, order: 1, roadId: "ohashi" },
  ],
};
const categories = [{ id: "c-veg", name: "食材" }];

const csv = (lines: string[]) => "﻿" + [STORE_CSV_HEADERS.join(","), ...lines].join("\r\n") + "\r\n";

function plan(text: string, extra: { shops?: EditableShop[]; vendors?: EditableVendor[]; replace?: boolean; roads?: Partial<{ northSouth: EditableRoad | null; ohashi: EditableRoad | null }> } = {}) {
  const parsed = parseStoreCsv(text);
  return planStoreImport({
    rows: parsed.rows,
    parseErrors: parsed.errors,
    shops: extra.shops ?? [],
    vendors: extra.vendors ?? [],
    categories,
    roads: { northSouth: otesuji, ohashi, ...extra.roads },
    replace: extra.replace ?? false,
    now: 1,
  });
}

describe("parseStoreCsv", () => {
  it("見出しの名前で列を探し、店名の列が無い元のテンプレートも読める", () => {
    const { rows, errors } = parseStoreCsv("﻿本番号,枝番,丁目,側,品目,ジャンル\r\n１２３,4,1丁目,北,柚子、文旦,食材\r\n");
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      expect.objectContaining({ line: 2, officialNumber: 123, branchNumber: 4, chome: "一丁目", side: "north", name: "", products: ["柚子", "文旦"], categoryName: "食材" }),
    ]);
  });

  it("丁目の書き方の揺れを受け付ける", () => {
    expect(["一丁目", "1丁目", "１", "7", "七"].map(normalizeChome)).toEqual(["一丁目", "一丁目", "一丁目", "七丁目", "七丁目"]);
    expect(normalizeChome("8丁目")).toBeNull();
  });

  it("正しくない行と重複した番号は、行番号つきで報告して取り込まない", () => {
    const { rows, errors } = parseStoreCsv(csv(["abc,,1,北,,,", "10,,9丁目,東,,,", "5,1,1,南,,,", "5,1,2,南,,,"]));
    expect(rows.map((r) => r.line)).toEqual([4]);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 5]);
    expect(errors[1].message).toContain("丁目「9丁目」");
    expect(errors[1].message).toContain("側「東」");
    expect(errors[2].message).toContain("4 行目と重複");
  });

  it("空行があっても、エラーの行番号はファイルの実際の行を指す", () => {
    const { errors } = parseStoreCsv(csv(["1,,一丁目,北,A,,", ",,,,,,", "x,,一丁目,北,B,,"]));
    expect(errors[0].line).toBe(4);
  });

  it("見出しが読めないときは、文字化けの対処を案内する", () => {
    const { errors } = parseStoreCsv("譛ｬ逡ｪ蜿ｷ,荳∫岼,蛛ｴ\r\n1,2,3\r\n");
    expect(errors[0].message).toContain("UTF-8");
  });

  it("必要な見出しが無ければ知らせる", () => {
    expect(parseStoreCsv("番号,店名\n1,a\n").errors[0].message).toContain("本番号");
  });
});

describe("planStoreImport", () => {
  it("北は道の北側、南は南側に、一丁目（西）から番号順に並べ、出店者を作って割り当てる", () => {
    const result = plan(csv(["2,,一丁目,北,朝市の八百屋,野菜,食材", "1,,一丁目,北,,,", "3,,二丁目,南,,,"]));
    expect(result.errors).toEqual([]);
    expect(result).toMatchObject({ createdSlotCount: 3, createdVendorCount: 3, deletedSlotCount: 0 });
    const shops = result.next!.shops;
    const byNumber = (n: number) => shops.find((s) => s.officialNumber === n)!;
    expect(byNumber(1).lat).toBeGreaterThan(33.5614); // 北側
    expect(byNumber(3).lat).toBeLessThan(33.5614); // 南側
    expect(byNumber(1).lng).toBeLessThan(byNumber(2).lng); // 番号順に西から
    expect(byNumber(2).roadOffsetM).toBe(7.5);
    expect(latToMeters(byNumber(2).lat - 33.5614)).toBeCloseTo(7.5, 1);
    const vendor = result.next!.vendors.find((v) => v.id === byNumber(2).vendorId)!;
    expect(vendor).toMatchObject({ name: "朝市の八百屋", categoryId: "c-veg", mainProducts: ["野菜"] });
    expect(result.next!.vendors.find((v) => v.id === byNumber(1).vendorId)!.name).toBe("一丁目 北 1");
    expect(result.warnings.some((w) => w.message.includes("店名が空"))).toBe(true);
  });

  it("新しい区画には空いている店番を付け、本番号・枝番を持たせる", () => {
    const existing: EditableShop = { locationId: "x", id: 1, position: 1, name: "仮", lat: 0, lng: 0 };
    const result = plan(csv(["123,4,一丁目,北,,,"]), { shops: [existing] });
    const created = result.next!.shops.find((s) => s.officialNumber === 123)!;
    expect(created).toMatchObject({ position: 2, branchNumber: 4, chome: "一丁目", roadId: "main" });
  });

  it("大橋通りは大橋通りの道に左右交互に並べる。七丁目以外なら知らせる", () => {
    const result = plan(csv(["701,,七丁目,大橋通り,,,", "702,,7,大橋通り,,,", "703,,六丁目,大橋通り,,,"]));
    const sides = result.next!.shops.map((s) => [s.roadId, s.roadSide]);
    expect(sides).toEqual([["ohashi", "left"], ["ohashi", "right"], ["ohashi", "left"]]);
    expect(result.warnings.some((w) => w.line === 4 && w.message.includes("六丁目"))).toBe(true);
  });

  it("大橋通りの道がまだ無ければ、大橋通りの行だけを飛ばして、ほかの行は取り込む", () => {
    const result = plan(csv(["701,,七丁目,大橋通り,,,", "101,,一丁目,北,,,"]), { roads: { ohashi: null } });
    expect(result.errors).toEqual([]);
    expect(result).toMatchObject({ rowCount: 1, skippedRowCount: 1, createdSlotCount: 1 });
    expect(result.next!.shops.map((s) => s.officialNumber)).toEqual([101]);
    expect(result.warnings.find((w) => w.line === 2)?.message).toContain("大橋通りの道がまだ無い");
  });

  it("飛ばした行と同じ番号の区画は、「CSVに無い区画を削除」でも消さない", () => {
    const ohashiSlot: EditableShop = { locationId: "o", id: 9, position: 9, name: "苗", lat: 0, lng: 0, officialNumber: 701 };
    // 区画がすでにあれば飛ばさずに出店者だけ更新するので、ここでは別の番号の区画で確かめる
    const other: EditableShop = { locationId: "x", id: 8, position: 8, name: "x", lat: 0, lng: 0, officialNumber: 999 };
    const result = plan(csv(["702,,七丁目,大橋通り,,,", "701,,七丁目,大橋通り,,,"]), { shops: [ohashiSlot, other], roads: { ohashi: null }, replace: true });
    expect(result.next!.shops.map((s) => s.locationId)).toEqual(["o"]);
    expect(result.skippedRowCount).toBe(1);
  });

  it("追手筋の道が無ければ、北・南の行は取り込めない理由として出す", () => {
    const result = plan(csv(["101,,一丁目,北,,,"]), { roads: { northSouth: null } });
    expect(result.next).toBeNull();
    expect(result.errors[0].message).toContain("追手筋");
  });

  it("同じ本番号・枝番の区画があれば、位置はそのままで出店者の情報を更新する（取り込み直しても増えない）", () => {
    const vendor: EditableVendor = { id: "v1", name: "旧店名", categoryId: null, strength: "こだわり", mainProducts: [] };
    const shop: EditableShop = {
      locationId: "loc", id: 7, position: 7, name: "旧店名", lat: 1, lng: 2, vendorId: "v1", officialNumber: 123, branchNumber: 4,
      roadId: "main", roadDistanceM: 50, roadSide: "left", roadOffsetM: 8,
    };
    const result = plan(csv(["123,4,一丁目,北,新店名,柚子,食材"]), { shops: [shop], vendors: [vendor] });
    expect(result).toMatchObject({ createdSlotCount: 0, updatedSlotCount: 1, createdVendorCount: 0, updatedVendorCount: 1 });
    expect(result.next!.shops[0]).toMatchObject({ locationId: "loc", position: 7, roadDistanceM: 50, name: "新店名" });
    expect(result.next!.vendors[0]).toMatchObject({ name: "新店名", categoryId: "c-veg", mainProducts: ["柚子"], strength: "こだわり" });
  });

  it("「CSVに無い区画を削除」なら、CSV に無い区画を消す（出店者の情報は残す）", () => {
    const dummy: EditableShop = { locationId: "dummy", id: 1, position: 1, name: "仮の店", lat: 0, lng: 0, vendorId: "v-dummy" };
    const vendors: EditableVendor[] = [{ id: "v-dummy", name: "仮の店", categoryId: null, strength: "", mainProducts: [] }];
    const result = plan(csv(["1,,一丁目,北,,,"]), { shops: [dummy], vendors, replace: true });
    expect(result.deletedSlotCount).toBe(1);
    expect(result.next!.shops.map((s) => s.locationId)).not.toContain("dummy");
    expect(result.next!.shops[0].position).toBe(1); // 消した区画の店番を使い回す
    expect(result.next!.vendors.map((v) => v.id)).toContain("v-dummy");
  });

  describe("同じ店名の登録済みの出店者", () => {
    const real: EditableVendor = { id: "v-real", name: "朝市の八百屋", categoryId: "c-veg", strength: "本人が書いた紹介", mainProducts: ["大根"] };
    // 住所録の番号の列ができる前の区画（初めての取り込みでは、どの行とも番号が一致しない）
    const oldShop: EditableShop = { locationId: "old", id: 9, position: 9, name: "朝市の八百屋", lat: 0, lng: 0, vendorId: "v-real" };

    it("初めての取り込みで既存の区画を消しても、同じ店名の出店者を二重に作らず、新しい区画に割り当てる", () => {
      const result = plan(csv(["1,,一丁目,北,朝市の八百屋,柚子,食材"]), { shops: [oldShop], vendors: [real], replace: true });
      expect(result).toMatchObject({ createdVendorCount: 0, reusedVendorCount: 1, deletedSlotCount: 1 });
      expect(result.next!.vendors).toHaveLength(1);
      expect(result.next!.shops[0].vendorId).toBe("v-real");
      // 本人が書いた情報は上書きしない
      expect(result.next!.vendors[0]).toMatchObject({ strength: "本人が書いた紹介", mainProducts: ["大根"] });
      expect(result.warnings.some((w) => w.message.includes("登録済みの出店者"))).toBe(true);
    });

    it("全角・半角や空白の違いは同じ店名として扱う", () => {
      const result = plan(csv(["1,,一丁目,北,朝市の 八百屋,,"]), { vendors: [real] });
      expect(result.reusedVendorCount).toBe(1);
    });

    it("同じ店名の出店者がほかの区画にいるときは、新しく作る", () => {
      const keep: EditableShop = { ...oldShop, officialNumber: 5 };
      const result = plan(csv(["1,,一丁目,北,朝市の八百屋,,"]), { shops: [keep], vendors: [real] });
      expect(result).toMatchObject({ createdVendorCount: 1, reusedVendorCount: 0 });
    });

    it("同じ店名の出店者が複数いて、どれか決められないときは、新しく作る", () => {
      const twin: EditableVendor = { ...real, id: "v-twin" };
      const result = plan(csv(["1,,一丁目,北,朝市の八百屋,,"]), { vendors: [real, twin] });
      expect(result).toMatchObject({ createdVendorCount: 1, reusedVendorCount: 0 });
    });

    it("CSV の同じ店名が2行あっても、1人の出店者を2つの区画に割り当てない", () => {
      const result = plan(csv(["1,,一丁目,北,朝市の八百屋,,", "2,,一丁目,北,朝市の八百屋,,"]), { vendors: [real] });
      expect(result).toMatchObject({ reusedVendorCount: 1, createdVendorCount: 1 });
    });
  });

  it("見つからないジャンルは未設定にして知らせる", () => {
    const result = plan(csv(["1,,一丁目,北,,,海産物"]));
    expect(result.next!.vendors[0].categoryId).toBeNull();
    expect(result.warnings[0].message).toContain("海産物");
  });
});

describe("defaultImportRoads", () => {
  it("名前から追手筋と大橋通りを選ぶ", () => {
    expect(defaultImportRoads([ohashi, otesuji])).toEqual({ northSouth: otesuji, ohashi });
  });
});
