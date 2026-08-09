import { describe, it, expect } from "vitest";
import { describeMarketEventDbError, validateImageUrl } from "./_helpers";

describe("validateImageUrl", () => {
  const valid =
    "https://abcdefg.supabase.co/storage/v1/object/public/market-events/buntan.jpg";

  it("Supabase Storage の公開URLは通す", () => {
    expect(validateImageUrl(valid)).toEqual({ url: valid, error: null });
  });

  it("未指定は null として通す", () => {
    expect(validateImageUrl(null)).toEqual({ url: null, error: null });
    expect(validateImageUrl(undefined)).toEqual({ url: null, error: null });
    expect(validateImageUrl("")).toEqual({ url: null, error: null });
    expect(validateImageUrl("   ")).toEqual({ url: null, error: null });
  });

  it("next/image の remotePatterns に載らない外部ホストは弾く", () => {
    // 許可しないと閲覧時に next/image がページごと落ちる
    expect(validateImageUrl("https://example.com/a.jpg").error).toBeTruthy();
  });

  it("supabase.co でも公開バケット以外は弾く", () => {
    expect(
      validateImageUrl("https://abc.supabase.co/storage/v1/object/sign/x/a.jpg").error
    ).toBeTruthy();
  });

  it("http は弾く", () => {
    expect(
      validateImageUrl("http://abc.supabase.co/storage/v1/object/public/x/a.jpg").error
    ).toBeTruthy();
  });

  it("ホスト名の後方一致をすり抜けさせない", () => {
    expect(
      validateImageUrl("https://evil-supabase.co.attacker.test/storage/v1/object/public/x/a.jpg")
        .error
    ).toBeTruthy();
  });

  it("URLとして壊れているものは弾く", () => {
    expect(validateImageUrl("not a url").error).toBeTruthy();
    expect(validateImageUrl(123).error).toBeTruthy();
  });

  it("長すぎるURLは弾く", () => {
    const long = `https://abc.supabase.co/storage/v1/object/public/${"a".repeat(500)}.jpg`;
    expect(validateImageUrl(long).error).toBeTruthy();
  });
});

describe("describeMarketEventDbError", () => {
  it("見どころの部分ユニーク索引違反は原因が伝わるメッセージにする", () => {
    const message = describeMarketEventDbError(
      {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "market_events_highlight_per_day_idx"',
      },
      "作成に失敗しました"
    );
    expect(message).toBe(
      "その日はすでに見どころが設定されています。先に既存の見どころを解除してください"
    );
  });

  it("それ以外のDBエラーはフォールバックのメッセージを返す", () => {
    expect(describeMarketEventDbError({ code: "23502", message: "not null" }, "作成に失敗しました")).toBe(
      "作成に失敗しました"
    );
    expect(describeMarketEventDbError(null, "作成に失敗しました")).toBe("作成に失敗しました");
  });
});
