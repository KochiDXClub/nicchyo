import { describe, expect, it } from "vitest";
import { parseMarketInput } from "./marketInput";

const valid = { name: "木曜市", slug: "mokuyo", weekday: 4, isPublic: false };

describe("parseMarketInput", () => {
  it("正しい入力を通す（公開は省略時 false）", () => {
    expect(parseMarketInput({ name: "木曜市", slug: "mokuyo", weekday: 4 })).toEqual({
      ok: true,
      data: { name: "木曜市", slug: "mokuyo", weekday: 4, isPublic: false },
    });
    expect(parseMarketInput({ ...valid, isPublic: true })).toMatchObject({ ok: true, data: { isPublic: true } });
  });

  it("名前は空・長すぎを弾き、前後の空白は取る", () => {
    expect(parseMarketInput({ ...valid, name: "  " }).ok).toBe(false);
    expect(parseMarketInput({ ...valid, name: "あ".repeat(41) }).ok).toBe(false);
    expect(parseMarketInput({ ...valid, name: "  火曜市  " })).toMatchObject({ ok: true, data: { name: "火曜市" } });
  });

  it("公開URLの名前は英小文字で始まる形だけ通す", () => {
    expect(parseMarketInput({ ...valid, slug: "Mokuyo" }).ok).toBe(false);
    expect(parseMarketInput({ ...valid, slug: "1abc" }).ok).toBe(false);
    expect(parseMarketInput({ ...valid, slug: "a" }).ok).toBe(false);
    expect(parseMarketInput({ ...valid, slug: "kayo-ichi" }).ok).toBe(true);
    expect(parseMarketInput({ ...valid, slug: "a".repeat(33) }).ok).toBe(false);
  });

  it("曜日は0〜6の整数だけ", () => {
    for (const weekday of [-1, 7, 1.5, "4", null]) {
      expect(parseMarketInput({ ...valid, weekday }).ok).toBe(false);
    }
    expect(parseMarketInput({ ...valid, weekday: 0 }).ok).toBe(true);
  });

  it("入力が不正な型なら弾く", () => {
    expect(parseMarketInput(null).ok).toBe(false);
    expect(parseMarketInput("x").ok).toBe(false);
    expect(parseMarketInput({ ...valid, isPublic: "yes" }).ok).toBe(false);
  });
});
