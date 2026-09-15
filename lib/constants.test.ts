import { describe, expect, it } from "vitest";
import { normalizeSiteUrl } from "./constants";

const DEFAULT = "https://nicchyo.jp";

describe("normalizeSiteUrl", () => {
  it.each([
    ["未設定", undefined, DEFAULT],
    ["空文字", "", DEFAULT],
    ["空白のみ", "  ", DEFAULT],
    // 末尾スラッシュを剥がした結果が空になるケース。
    // フォールバックの後に剥がす実装だと "" が返り、new URL("") で全ページが500になる
    ["スラッシュのみ", "/", DEFAULT],
    ["スラッシュの繰り返し", "///", DEFAULT],
    // スキーム無し・http/https以外は new URL() が投げるか、おかしなURLになる
    ["スキーム無し", "nicchyo.jp", DEFAULT],
    ["http/https以外", "javascript:alert(1)", DEFAULT],
    ["正常な値", "https://nicchyo.jp", "https://nicchyo.jp"],
    ["末尾スラッシュ付き", "https://nicchyo.jp/", "https://nicchyo.jp"],
    ["前後に空白", "  https://nicchyo.jp  ", "https://nicchyo.jp"],
    ["プレビュー環境のhttp", "http://localhost:3000", "http://localhost:3000"],
    // new URL() は通るが、そのまま連結すると壊れる入力。
    // 例: "https://nicchyo.jp?x=1" + "/shops/001" -> パスがクエリに飲まれる
    ["クエリ付き", "https://nicchyo.jp?x=1", DEFAULT],
    ["フラグメント付き", "https://nicchyo.jp#a", DEFAULT],
    ["スラッシュ1本", "https:/nicchyo.jp", DEFAULT],
    ["大文字スキーム", "HTTPS://nicchyo.jp", DEFAULT],
    ["既定ポート付き", "https://nicchyo.jp:443", DEFAULT],
    // サブパス運用は維持する
    ["サブパス", "https://nicchyo.jp/base/", "https://nicchyo.jp/base"],
  ])("%s: %s -> %s", (_label, input, expected) => {
    expect(normalizeSiteUrl(input)).toBe(expected);
  });

  it("戻り値を連結してもURLが壊れない", () => {
    for (const input of ["https://nicchyo.jp?x=1", "https://nicchyo.jp#a", "https://nicchyo.jp/"]) {
      expect(`${normalizeSiteUrl(input)}/shops/001`).toBe("https://nicchyo.jp/shops/001");
    }
  });

  it("戻り値は必ず new URL() を通せる", () => {
    for (const input of [undefined, "", "  ", "/", "///", "nicchyo.jp", "https://nicchyo.jp/"]) {
      expect(() => new URL(normalizeSiteUrl(input))).not.toThrow();
    }
  });
});
