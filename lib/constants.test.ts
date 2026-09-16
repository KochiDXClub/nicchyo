import { describe, expect, it, vi } from "vitest";
import { normalizeSiteUrl } from "./constants";

const DEFAULT = "https://nicchyo.jp";

describe("normalizeSiteUrl", () => {
  describe("既定値にフォールバックする", () => {
    it.each([
      ["未設定", undefined],
      ["空文字", ""],
      ["空白のみ", "  "],
      // 末尾スラッシュを剥がした結果が空になるケース。
      // フォールバックの後に剥がす実装だと "" が返り、new URL("") で全ページが500になる
      ["スラッシュのみ", "/"],
      ["スラッシュの繰り返し", "///"],
      // スキーム無し・http/https以外は new URL() が投げるか、おかしなURLになる
      ["スキーム無し", "nicchyo.jp"],
      ["http/https以外", "javascript:alert(1)"],
    ])("%s: %s", (_label, input) => {
      expect(normalizeSiteUrl(input)).toBe(DEFAULT);
    });
  });

  // 既定値と同じホストで書くと「正規化した」のか「既定値に戻した」のかを
  // テストが区別できなくなるため、正規化のケースは example.com で確認する。
  // （区別できないと「少しでも怪しければ既定値に戻す」実装に書き換えられても気づけず、
  //   プレビュー環境で本番ドメインのURLが出るようになる）
  describe("入力のホストを保ったまま正規化する", () => {
    it.each([
      ["正常な値", "https://example.com", "https://example.com"],
      ["末尾スラッシュ付き", "https://example.com/", "https://example.com"],
      ["前後に空白", "  https://example.com  ", "https://example.com"],
      ["プレビュー環境のhttp", "http://localhost:3000", "http://localhost:3000"],
      // new URL() は通るが、そのまま連結すると壊れる入力。
      // 例: "https://example.com?x=1" + "/shops/001" -> パスがクエリに飲まれる
      ["クエリ付き", "https://example.com?x=1", "https://example.com"],
      ["フラグメント付き", "https://example.com#a", "https://example.com"],
      ["スラッシュ1本", "https:/example.com", "https://example.com"],
      ["大文字スキーム", "HTTPS://example.com", "https://example.com"],
      ["既定ポート付き", "https://example.com:443", "https://example.com"],
      ["既定でないポート", "https://example.com:8443", "https://example.com:8443"],
      ["認証情報付き", "https://user:pw@example.com/", "https://example.com"],
      // サブパス運用は維持する
      ["サブパス", "https://example.com/base/", "https://example.com/base"],
    ])("%s: %s -> %s", (_label, input, expected) => {
      expect(normalizeSiteUrl(input)).toBe(expected);
    });
  });

  it("戻り値を連結してもURLが壊れない", () => {
    for (const input of ["https://example.com?x=1", "https://example.com#a", "https://example.com/"]) {
      expect(`${normalizeSiteUrl(input)}/shops/001`).toBe("https://example.com/shops/001");
    }
  });

  it("戻り値は必ず new URL() を通せる", () => {
    for (const input of [undefined, "", "  ", "/", "///", "nicchyo.jp", "https://example.com/"]) {
      expect(() => new URL(normalizeSiteUrl(input))).not.toThrow();
    }
  });

  describe("設定ミスに気づけるようにする", () => {
    it("値が入っているのに不正なときは警告を出す", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      normalizeSiteUrl("nicchyo.jp");
      expect(warn).toHaveBeenCalledOnce();
      warn.mockRestore();
    });

    it("未設定・空文字は想定内なので警告を出さない", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      normalizeSiteUrl(undefined);
      normalizeSiteUrl("");
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
