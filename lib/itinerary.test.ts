import { describe, it, expect } from "vitest";
import {
  buildItineraryTemplate,
  generateItinerary,
  parseItineraryTemplateOutput,
  resolvePlanShopIds,
} from "./itinerary";

describe("parseItineraryTemplateOutput", () => {
  const fallback = { startAt: "10:00", interest: "食べ物", stops: 3, nowHHMM: "09:30" };

  it("タイムライン行から店名と時刻を取り出す（時刻は文字列のまま）", () => {
    const output = [
      "【おさんぽプラン】",
      "■ 概要",
      "テーマ: 食べ歩き",
      "■ タイムライン",
      "1. 10:00 | 田中青果 | 朝どれ野菜を見る",
      "2. 10:20 | 山本刃物 | 包丁を眺める",
    ].join("\n");
    const plan = parseItineraryTemplateOutput(output, fallback);
    expect(plan.shops).toHaveLength(2);
    expect(plan.shops[0]).toMatchObject({ id: 0, name: "田中青果", time: "10:00" });
    expect(plan.shops[1]).toMatchObject({ name: "山本刃物", time: "10:20" });
    expect(plan.summary).toBe("食べ歩き");
  });

  it("時刻が不正な行は開始時刻から20分間隔で補完する", () => {
    const output = ["1. あさ | 田中青果 | 見る", "2. ?? | 山本刃物 | 見る"].join("\n");
    const plan = parseItineraryTemplateOutput(output, fallback);
    expect(plan.shops[0].time).toBe("10:00");
    expect(plan.shops[1].time).toBe("10:20");
  });

  it("「今すぐ」のときは nowHHMM を起点にする（タイムゾーン非依存）", () => {
    const output = "1. xx | 店 | 見る";
    const plan = parseItineraryTemplateOutput(output, {
      ...fallback,
      startAt: "今すぐ",
      nowHHMM: "13:45",
    });
    expect(plan.shops[0].time).toBe("13:45");
  });

  it("タイムライン行がなければ stops 件のプレースホルダを作る", () => {
    const plan = parseItineraryTemplateOutput("なにもなし", fallback);
    expect(plan.shops).toHaveLength(3);
    expect(plan.shops.every((s) => s.id === 0)).toBe(true);
    expect(plan.shops[2].time).toBe("10:40");
  });

  it("stops を超えるタイムライン行は切り捨てる", () => {
    const output = [1, 2, 3, 4, 5]
      .map((n) => `${n}. 10:0${n} | 店${n} | 見る`)
      .join("\n");
    const plan = parseItineraryTemplateOutput(output, { ...fallback, stops: 2 });
    expect(plan.shops).toHaveLength(2);
  });
});

describe("resolvePlanShopIds", () => {
  const candidates = [
    { id: 12, name: "田中青果" },
    { id: 34, name: "山本刃物店" },
    { id: 56, name: "浜田の芋屋" },
  ];

  it("完全一致で実IDに解決する", () => {
    const plan = {
      title: "t",
      shops: [{ id: 0, name: "田中青果", time: "10:00" }],
    };
    const resolved = resolvePlanShopIds(plan, candidates);
    expect(resolved.shops[0].id).toBe(12);
  });

  it("部分一致（双方向）でも解決する", () => {
    const plan = {
      title: "t",
      shops: [
        { id: 0, name: "山本刃物", time: "10:00" }, // 候補名の一部
        { id: 0, name: "浜田の芋屋（本店）", time: "10:20" }, // 候補名を含む
      ],
    };
    const resolved = resolvePlanShopIds(plan, candidates);
    expect(resolved.shops[0].id).toBe(34);
    expect(resolved.shops[1].id).toBe(56);
  });

  it("同じ候補を2回使わない・未解決は id 0 のまま", () => {
    const plan = {
      title: "t",
      shops: [
        { id: 0, name: "田中青果", time: "10:00" },
        { id: 0, name: "田中青果", time: "10:20" },
        { id: 0, name: "存在しない店", time: "10:40" },
      ],
    };
    const resolved = resolvePlanShopIds(plan, candidates);
    expect(resolved.shops[0].id).toBe(12);
    expect(resolved.shops[1].id).toBe(0);
    expect(resolved.shops[2].id).toBe(0);
  });
});

describe("generateItinerary", () => {
  const shopCandidates = [
    { id: 1, name: "A" },
    { id: 2, name: "B" },
    { id: 3, name: "C" },
    { id: 4, name: "D" },
  ];

  it("開始時刻から20分間隔で実IDつきの旅程を作る", () => {
    const plan = generateItinerary({
      shopCandidates,
      stops: 3,
      startAt: "11:00",
      interest: "工芸",
    });
    expect(plan.shops.map((s) => s.id)).toEqual([1, 2, 3]);
    expect(plan.shops.map((s) => s.time)).toEqual(["11:00", "11:20", "11:40"]);
    expect(plan.summary).toBe("工芸");
  });

  it("「今すぐ」は nowHHMM を起点にする", () => {
    const plan = generateItinerary({
      shopCandidates,
      stops: 2,
      startAt: "今すぐ",
      nowHHMM: "09:10",
    });
    expect(plan.shops.map((s) => s.time)).toEqual(["09:10", "09:30"]);
  });

  it("候補が stops より少なければ候補数に丸める", () => {
    const plan = generateItinerary({
      shopCandidates: shopCandidates.slice(0, 2),
      stops: 5,
      startAt: "10:00",
    });
    expect(plan.shops).toHaveLength(2);
  });

  it("日付をまたぐ時刻は 24 時間で折り返す", () => {
    const plan = generateItinerary({
      shopCandidates,
      stops: 2,
      startAt: "23:50",
    });
    expect(plan.shops.map((s) => s.time)).toEqual(["23:50", "00:10"]);
  });
});

describe("buildItineraryTemplate", () => {
  it("要件がテンプレートに埋め込まれる", () => {
    const template = buildItineraryTemplate({ stops: 4, startAt: "10:30", interest: "花" });
    expect(template).toContain("テーマ: 花");
    expect(template).toContain("開始時刻: 10:30");
    expect(template).toContain("立ち寄り件数: 4件");
  });
});
