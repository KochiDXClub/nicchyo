import { describe, expect, it } from "vitest";
import { INTENTION_MIN_REPORTABLE, summariseIntentions, type IntentionSummaryRow } from "./intentionSummary";
import type { IntentionPlace } from "./intention";

const places: IntentionPlace[] = [
  { id: "p1", storeNumber: 1, name: null, chome: 1, lat: null, lng: null },
  { id: "p2", storeNumber: 2, name: "追手筋側", chome: 1, lat: null, lng: null },
  { id: "p3", storeNumber: 3, name: null, chome: 2, lat: null, lng: null },
];

/** 場所まで選んだ回答（丁目は場所から決まる） */
const rowsFor = (counts: Record<string, number>): IntentionSummaryRow[] =>
  Object.entries(counts).flatMap(([place_id, n]) => {
    const chome = places.find((p) => p.id === place_id)?.chome ?? 1;
    return Array.from({ length: n }, () => ({ place_id, chome }));
  });

/** 丁目だけの回答 */
const chomeRows = (counts: Record<number, number>): IntentionSummaryRow[] =>
  Object.entries(counts).flatMap(([chome, n]) => Array.from({ length: n }, () => ({ place_id: null, chome: Number(chome) })));

const countOf = (summary: ReturnType<typeof summariseIntentions>, placeId: string) =>
  summary.places.find((c) => c.placeId === placeId)?.count;
const chomeCount = (summary: ReturnType<typeof summariseIntentions>, chome: number) =>
  summary.chomes.find((c) => c.chome === chome)?.count;

describe("summariseIntentions", () => {
  it("回答が最少人数に届かないときは、回答者数も全項目も伏せる", () => {
    const summary = summariseIntentions(rowsFor({ p1: 2 }), places);
    expect(summary.respondents).toBeNull();
    expect(summary.places.every((c) => c.count === null)).toBe(true);
    expect(summary.chomes.every((c) => c.count === null)).toBe(true);
  });

  it("十分な人数では丁目ごと・場所ごとに数える（区画番号・名前・丁目つき）", () => {
    const summary = summariseIntentions(rowsFor({ p1: 5, p2: 4, p3: 0 }), places);
    expect(summary.respondents).toBe(9);
    expect(countOf(summary, "p1")).toBe(5);
    expect(countOf(summary, "p2")).toBe(4);
    expect(countOf(summary, "p3")).toBe(0);
    expect(summary.places[1]).toEqual({ placeId: "p2", storeNumber: 2, name: "追手筋側", chome: 1, lat: null, lng: null, count: 4 });
    // 丁目は場所から決まった回答も合算する（1丁目 = p1 + p2）
    expect(chomeCount(summary, 1)).toBe(9);
    expect(chomeCount(summary, 2)).toBe(0);
  });

  it("丁目だけの回答も丁目の件数に数え、場所の件数には入れない", () => {
    const summary = summariseIntentions([...chomeRows({ 3: 4 })], places);
    expect(chomeCount(summary, 3)).toBe(4);
    expect(summary.places.every((c) => c.count === 0)).toBe(true);
  });

  it("伏せた項目（1〜2件）があれば、表示中の最小の項目も伏せる", () => {
    // p3 は2件で伏せる。残りの最小の p2(4) も伏せ、合計から逆算させない
    const summary = summariseIntentions(rowsFor({ p1: 6, p2: 4, p3: 2 }), places);
    expect(countOf(summary, "p3")).toBeNull();
    expect(countOf(summary, "p2")).toBeNull();
    expect(countOf(summary, "p1")).toBe(6);
  });

  it("伏せた項目が2つ以上でも、表示中の最小を伏せて、合計から逆算させない", () => {
    // p2=1 と p3=2 は伏せる。合計 13 - 10 = 3 から両方の内訳を決められないよう、p1(10) も伏せる
    const summary = summariseIntentions(rowsFor({ p1: 10, p2: 1, p3: 2 }), places);
    expect(summary.places.map((c) => c.count)).toEqual([null, null, null]);
    expect(summary.respondents).toBe(13);
  });

  it("件数が最少人数未満の項目だけを伏せる（0件は伏せない。伏せが無いときは他を消さない）", () => {
    const summary = summariseIntentions(rowsFor({ p1: 3, p2: 4, p3: 0 }), places);
    expect(summary.places.map((c) => c.count)).toEqual([3, 4, 0]);
    expect(INTENTION_MIN_REPORTABLE).toBe(3);
  });

  it("mask: false（運営の画面）は伏せずに件数を返す", () => {
    const summary = summariseIntentions(rowsFor({ p1: 2 }), places, { mask: false });
    expect(summary.respondents).toBe(2);
    expect(countOf(summary, "p1")).toBe(2);
  });

  it("集計に店舗の情報や、ひとことは含まれない", () => {
    const summary = summariseIntentions(rowsFor({ p1: 3 }), places);
    expect(JSON.stringify(summary)).not.toMatch(/vendor|note|shop/i);
  });
});
