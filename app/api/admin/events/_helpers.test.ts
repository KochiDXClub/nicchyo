import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateImageUrl, MARKET_EVENT_IMAGE_PREFIX } from "./_helpers";

const PROJECT = "https://ourproject.supabase.co";
const valid = `${PROJECT}${MARKET_EVENT_IMAGE_PREFIX}1234-abcd.jpg`;

describe("validateImageUrl", () => {
  const original = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = PROJECT;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = original;
  });

  it("自プロジェクトのアップロード先URLは通す", () => {
    expect(validateImageUrl(valid)).toEqual({ url: valid, error: null });
  });

  it("未指定は null として通す", () => {
    expect(validateImageUrl(null)).toEqual({ url: null, error: null });
    expect(validateImageUrl(undefined)).toEqual({ url: null, error: null });
    expect(validateImageUrl("")).toEqual({ url: null, error: null });
    expect(validateImageUrl("   ")).toEqual({ url: null, error: null });
  });

  it("別の Supabase プロジェクトは弾く", () => {
    // *.supabase.co は誰でも取得できるので、後方一致だと攻撃者のプロジェクトが通ってしまう
    const attacker = `https://attackerproj.supabase.co${MARKET_EVENT_IMAGE_PREFIX}a.jpg`;
    expect(validateImageUrl(attacker).error).toBeTruthy();
  });

  it("多段サブドメインは弾く", () => {
    // next.config.js の `*.supabase.co` は1ラベルしかマッチしないので、
    // 通してしまうと next/image が落ちる
    const multi = `https://a.b.supabase.co${MARKET_EVENT_IMAGE_PREFIX}a.jpg`;
    expect(validateImageUrl(multi).error).toBeTruthy();
  });

  it("自プロジェクトでもアップロード先以外のパスは弾く", () => {
    expect(
      validateImageUrl(`${PROJECT}/storage/v1/object/public/vendor-images/someone/a.jpg`).error
    ).toBeTruthy();
    expect(
      validateImageUrl(`${PROJECT}/storage/v1/object/sign/vendor-images/market-events/a.jpg`)
        .error
    ).toBeTruthy();
  });

  it("プレフィックス外に出るパスを弾く", () => {
    expect(
      validateImageUrl(`${PROJECT}${MARKET_EVENT_IMAGE_PREFIX}%2e%2e/secret.jpg`).error
    ).toBeTruthy();
  });

  it("クエリやフラグメントが付いたURLは弾く", () => {
    expect(validateImageUrl(`${valid}?x=1`).error).toBeTruthy();
    expect(validateImageUrl(`${valid}#a`).error).toBeTruthy();
  });

  it("http は弾く（オリジンが一致しない）", () => {
    expect(
      validateImageUrl(`http://ourproject.supabase.co${MARKET_EVENT_IMAGE_PREFIX}a.jpg`).error
    ).toBeTruthy();
  });

  it("ローカルの Supabase でも同じ判定で通る", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    const local = `http://127.0.0.1:54321${MARKET_EVENT_IMAGE_PREFIX}a.jpg`;
    expect(validateImageUrl(local)).toEqual({ url: local, error: null });
  });

  it("URLとして壊れているものは弾く", () => {
    expect(validateImageUrl("not a url").error).toBeTruthy();
    expect(validateImageUrl(123).error).toBeTruthy();
  });

  it("長すぎるURLは弾く", () => {
    expect(
      validateImageUrl(`${PROJECT}${MARKET_EVENT_IMAGE_PREFIX}${"a".repeat(500)}.jpg`).error
    ).toBeTruthy();
  });

  it("保存先が未設定なら弾く", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(validateImageUrl(valid).error).toBeTruthy();
  });
});
