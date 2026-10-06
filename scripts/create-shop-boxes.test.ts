import { describe, expect, it } from "vitest";
import { parseCsvLine, toVendorRow } from "./create-shop-boxes.mjs";

const ID = "005b840f-d9ec-4547-99ff-d4f0ecdfa474";
const categories = new Map([["生活雑貨", "cat-1"]]);

describe("toVendorRow（店舗の箱：アカウントなしの店舗の行）", () => {
  it("CSV の id を店舗の ID にし、アカウントの ID は使わない。ログインしない前提なのでパスワード変更の印は付けない", () => {
    const { row } = toVendorRow({ id: ID, name: " 谷口のお店 ", category: "生活雑貨", shop_strength: "", stall_style: "昼まで" }, categories);

    expect(row).toEqual({
      id: ID,
      shop_name: "谷口のお店",
      strength: null,
      style: "昼まで",
      category_id: "cat-1",
      role: "vendor",
      must_change_password: false,
    });
  });

  it("uuid でない id・店名が空の行は、理由つきで飛ばす", () => {
    expect(toVendorRow({ id: "legacy-1", name: "a" }, categories).skip).toMatch(/uuid/);
    expect(toVendorRow({ id: ID, name: "  " }, categories).skip).toMatch(/店名/);
  });

  it("categories.csv に無いカテゴリは、未分類（null）で作り、知らせる", () => {
    const result = toVendorRow({ id: ID, name: "a", category: "未知のカテゴリ" }, categories);

    expect(result.row?.category_id).toBeNull();
    expect(result.unknownCategory).toBe("未知のカテゴリ");
  });
});

describe("parseCsvLine", () => {
  it("引用符の中のカンマと、二重引用符を扱う", () => {
    expect(parseCsvLine('a,"b,c","d ""e"""')).toEqual(["a", "b,c", 'd "e"']);
  });
});
