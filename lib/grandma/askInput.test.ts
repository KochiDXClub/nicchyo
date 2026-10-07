import { describe, it, expect } from "vitest";
import {
  ASK_IMAGE_MAX_BYTES,
  ASK_MEMORY_SUMMARY_MAX,
  ASK_SHOP_NAME_MAX,
  ASK_TEXT_MAX,
  AskMultipartTextFieldsSchema,
  checkAskImage,
  parseLocationField,
} from "./askInput";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0]);

describe("AskMultipartTextFieldsSchema", () => {
  const base = { text: "", memorySummary: "", shopName: "" };
  it("上限ちょうどは通り、超えると弾く", () => {
    expect(AskMultipartTextFieldsSchema.safeParse({ ...base, text: "a".repeat(ASK_TEXT_MAX) }).success).toBe(true);
    expect(AskMultipartTextFieldsSchema.safeParse({ ...base, text: "a".repeat(ASK_TEXT_MAX + 1) }).success).toBe(false);
    expect(
      AskMultipartTextFieldsSchema.safeParse({ ...base, memorySummary: "a".repeat(ASK_MEMORY_SUMMARY_MAX + 1) }).success
    ).toBe(false);
    expect(
      AskMultipartTextFieldsSchema.safeParse({ ...base, shopName: "a".repeat(ASK_SHOP_NAME_MAX + 1) }).success
    ).toBe(false);
  });
});

describe("parseLocationField", () => {
  it("数値で範囲内なら採用する", () => {
    expect(parseLocationField('{"lat":33.56,"lng":133.53}')).toEqual({ lat: 33.56, lng: 133.53 });
  });
  it.each(['{"lat":"33.5","lng":133.5}', '{"lat":99,"lng":133.5}', '{"lat":33,"lng":181}', "123", "null", "{broken"])(
    "%s は位置情報なし(null)にする",
    (raw) => {
      expect(parseLocationField(raw)).toBeNull();
    }
  );
});

describe("checkAskImage", () => {
  it("JPEG / PNG は中身から形式を決めて通す", () => {
    expect(checkAskImage({ size: 100, declaredType: "image/jpeg", head: JPEG })).toEqual({ ok: true, mime: "image/jpeg" });
    expect(checkAskImage({ size: 100, declaredType: "image/png", head: PNG })).toEqual({ ok: true, mime: "image/png" });
  });
  it("申告が空でも中身が画像なら通す", () => {
    expect(checkAskImage({ size: 100, declaredType: "", head: JPEG }).ok).toBe(true);
  });
  it("5MB超は弾く", () => {
    expect(checkAskImage({ size: ASK_IMAGE_MAX_BYTES + 1, declaredType: "image/jpeg", head: JPEG }).ok).toBe(false);
    expect(checkAskImage({ size: ASK_IMAGE_MAX_BYTES, declaredType: "image/jpeg", head: JPEG }).ok).toBe(true);
  });
  it("許可外のMIME(gif/svg)は弾く", () => {
    expect(checkAskImage({ size: 100, declaredType: "image/gif", head: GIF }).ok).toBe(false);
    expect(checkAskImage({ size: 100, declaredType: "image/svg+xml", head: JPEG }).ok).toBe(false);
  });
  it("MIMEを偽っても中身が画像でなければ弾く", () => {
    expect(checkAskImage({ size: 100, declaredType: "image/jpeg", head: GIF }).ok).toBe(false);
  });
});
