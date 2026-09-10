import { describe, expect, it } from "vitest";

import { buildMapAgentPrompt, type MapAgentCandidate } from "./mapAgentPrompt";

const candidates: MapAgentCandidate[] = [
  {
    id: 12,
    name: "いも天のお店",
    category: "食べ歩き",
    products: ["いも天"],
    lat: 33.5651,
    lng: 133.5312,
  },
];

const answers = { purpose: "食べ歩き", needs: "いも天", visitCount: "3件", favoriteFood: "揚げ物" };

describe("buildMapAgentPrompt", () => {
  it("来訪者の緯度・経度をプロンプトに含めない", () => {
    const prompt = buildMapAgentPrompt(answers, candidates, { lat: 33.56789, lng: 133.53123 });

    // /privacy に「緯度・経度は外部へ渡らない」と書いている。ここが破れると記載が嘘になる
    expect(prompt).not.toContain("33.56789");
    expect(prompt).not.toContain("133.53123");
    expect(prompt).not.toContain("出発地点: lat");
  });

  it("居場所は会場のあたりかどうかの区分だけを渡す", () => {
    const onSite = buildMapAgentPrompt(answers, candidates, { lat: 33.565, lng: 133.531 });
    expect(onSite).toContain("会場のあたり");

    const away = buildMapAgentPrompt(answers, candidates, { lat: 34.0, lng: 134.0 });
    expect(away).toContain("会場から離れた");
  });

  it("位置情報を許可されていないときは不明として渡す", () => {
    const prompt = buildMapAgentPrompt(answers, candidates, null);

    expect(prompt).toContain("来訪者の居場所: 不明");
  });

  it("候補店舗の情報は渡す（お店の座標は公開情報なので含めてよい）", () => {
    const prompt = buildMapAgentPrompt(answers, candidates, null);

    expect(prompt).toContain("いも天のお店");
    expect(prompt).toContain("id:12");
  });
});
