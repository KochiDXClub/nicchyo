import { describe, expect, it } from "vitest";
import { EMPTY_HISTORY, netChanges, recordOperation, type EditState } from "./editHistory";
import { buildSavePayloadDiff } from "./useMapEditData";
import type { EditableLandmark, EditableShop } from "./types";

const shop = (locationId: string, overrides: Partial<EditableShop> = {}): EditableShop => ({
  locationId,
  id: 1,
  position: 1,
  name: "未設定店舗 1",
  lat: 33.56,
  lng: 133.53,
  ...overrides,
});

const landmark = (key: string): EditableLandmark => ({
  key,
  name: key,
  description: "",
  url: "/x.png",
  lat: 33.56,
  lng: 133.53,
  widthPx: 10,
  heightPx: 10,
  showAtMinZoom: false,
});

const base: EditState = { shops: [shop("a"), shop("b")], roads: [], landmarks: [landmark("castle")], vendors: [] };

function changesFrom(steps: EditState[]) {
  let history = EMPTY_HISTORY;
  for (let i = 1; i < steps.length; i += 1) {
    history = recordOperation(history, { id: i, label: "", text: "", recordedAt: i * 10_000, before: steps[i - 1], after: steps[i] });
  }
  return netChanges(history);
}

describe("buildSavePayloadDiff", () => {
  it("変わった区画・建物だけを送り、削除は id で送る", () => {
    const after: EditState = {
      shops: [shop("a", { vendorId: "v1", name: "店A" })],
      roads: [],
      landmarks: [],
      vendors: [],
    };
    const diff = buildSavePayloadDiff(changesFrom([base, after]));
    expect(diff.shops.updated.map((s) => s.locationId)).toEqual(["a"]);
    expect(diff.shops.deletedLocationIds).toEqual(["b"]);
    expect(diff.landmarks.upsert).toEqual([]);
    expect(diff.landmarks.deletedKeys).toEqual(["castle"]);
  });

  it("登録・変更した出店者を送る", () => {
    const vendor = { id: "new-vendor-1", name: "新しい店", categoryId: null, strength: "", mainProducts: ["柚子"] };
    const after: EditState = { ...base, vendors: [vendor], shops: [shop("a", { vendorId: vendor.id }), base.shops[1]] };
    const diff = buildSavePayloadDiff(changesFrom([base, after]));
    expect(diff.vendors.upsert).toEqual([vendor]);
    expect(diff.shops.updated.map((s) => s.vendorId)).toEqual(["new-vendor-1"]);
  });

  it("画面で追加してから消した区画は送らない", () => {
    const added: EditState = { ...base, shops: [...base.shops, shop("new-1")] };
    const diff = buildSavePayloadDiff(changesFrom([base, added, base]));
    expect(diff.shops.updated).toEqual([]);
    expect(diff.shops.deletedLocationIds).toEqual([]);
  });

  it("取り消して元に戻った変更は送らない", () => {
    const moved: EditState = { ...base, shops: [shop("a", { lat: 1 }), base.shops[1]] };
    const diff = buildSavePayloadDiff(changesFrom([base, moved, base]));
    expect(diff.shops.updated).toEqual([]);
  });
});
