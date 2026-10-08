import { describe, it, expect } from "vitest";
import {
  haversineKm,
  classifyLocationType,
  describeLocationForPrompt,
  classifyIntent,
  extractKeywords,
  sanitizeLikeKeyword,
  isShopRelatedQuestion,
  isSeasonalQuestion,
  getCurrentSeasonInfo,
  isUnsupportedQuestion,
  buildErrorResponse,
  buildHistoryContext,
  isValidFollowUpQuestion,
  buildFallbackFollowUpQuestion,
} from "./consultUtils";
import { CONSULT_CHARACTERS } from "@/app/(public)/consult/data/consultCharacters";

describe("haversineKm", () => {
  it("同一地点は0km", () => {
    expect(haversineKm({ lat: 33.565, lng: 133.531 }, { lat: 33.565, lng: 133.531 })).toBe(0);
  });

  it("日曜市付近の2点間距離が妥当な範囲", () => {
    const d = haversineKm({ lat: 33.565, lng: 133.531 }, { lat: 33.566, lng: 133.532 });
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(0.5);
  });
});

describe("classifyLocationType", () => {
  it("nullは unknown", () => {
    expect(classifyLocationType(null)).toBe("unknown");
  });

  it("日曜市中心付近は on_site", () => {
    expect(classifyLocationType({ lat: 33.565, lng: 133.531 })).toBe("on_site");
  });

  it("離れた場所は pre_visit", () => {
    expect(classifyLocationType({ lat: 34.0, lng: 134.0 })).toBe("pre_visit");
  });
});

describe("describeLocationForPrompt", () => {
  it("緯度・経度をそのまま含めない", () => {
    const text = describeLocationForPrompt({ lat: 33.565, lng: 133.531 });
    expect(text).not.toContain("33.5");
    expect(text).not.toContain("133.5");
  });

  it("会場のあたりにいることを伝える", () => {
    expect(describeLocationForPrompt({ lat: 33.565, lng: 133.531 })).toContain("会場のあたり");
  });

  it("離れているときは、向かう途中であることが分かる言い方にする", () => {
    expect(describeLocationForPrompt({ lat: 34.0, lng: 134.0 })).toContain("会場から離れた");
  });

  it("取れていないときは不明", () => {
    expect(describeLocationForPrompt(null)).toBe("不明");
  });
});

describe("classifyIntent", () => {
  it("人気を含む質問は人気商品", () => {
    expect(classifyIntent("人気の野菜は？")).toBe("人気商品");
  });

  it("おすすめを含む質問はおすすめ", () => {
    expect(classifyIntent("おすすめのお店は？")).toBe("おすすめ");
  });

  it("マッチしない場合はその他", () => {
    expect(classifyIntent("この野菜の産地は？")).toBe("その他");
  });
});

describe("extractKeywords", () => {
  it("ストップワードを除外してスペース区切りのトークンを返す", () => {
    const keywords = extractKeywords("おすすめ 野菜 教え");
    expect(keywords).toContain("おすすめ");
    expect(keywords).toContain("野菜");
    expect(keywords).not.toContain("教え");
  });

  it("重複を除去する", () => {
    const keywords = extractKeywords("野菜 野菜 果物");
    const set = new Set(keywords);
    expect(set.size).toBe(keywords.length);
  });

  it("最大6件を返す", () => {
    const keywords = extractKeywords("野菜 果物 魚肉 お菓子 お花 苗木 工芸品 ハンドメイド");
    expect(keywords.length).toBeLessThanOrEqual(6);
  });
});

describe("sanitizeLikeKeyword", () => {
  it("SQLワイルドカード文字を除去する", () => {
    expect(sanitizeLikeKeyword("野菜%_,テスト")).toBe("野菜テスト");
  });
});

describe("isShopRelatedQuestion", () => {
  it("お店を含む質問はtrue", () => {
    expect(isShopRelatedQuestion("おすすめのお店は？")).toBe(true);
  });

  it("無関係な質問はfalse", () => {
    expect(isShopRelatedQuestion("今日は何曜日？")).toBe(false);
  });
});

describe("isSeasonalQuestion", () => {
  it("季節を含む質問はtrue", () => {
    expect(isSeasonalQuestion("今の季節におすすめは？")).toBe(true);
  });

  it("季節に無関係な質問はfalse", () => {
    expect(isSeasonalQuestion("おすすめのお店は？")).toBe(false);
  });
});

describe("getCurrentSeasonInfo", () => {
  it("3月は春ー夏", () => {
    const result = getCurrentSeasonInfo(new Date("2024-03-15"));
    expect(result.seasonId).toBe(0);
    expect(result.seasonName).toBe("春ー夏");
  });

  it("7月は夏ー秋", () => {
    const result = getCurrentSeasonInfo(new Date("2024-07-01"));
    expect(result.seasonId).toBe(1);
    expect(result.seasonName).toBe("夏ー秋");
  });

  it("10月は秋ー冬", () => {
    const result = getCurrentSeasonInfo(new Date("2024-10-01"));
    expect(result.seasonId).toBe(2);
    expect(result.seasonName).toBe("秋ー冬");
  });

  it("1月は冬ー春", () => {
    const result = getCurrentSeasonInfo(new Date("2024-01-15"));
    expect(result.seasonId).toBe(3);
    expect(result.seasonName).toBe("冬ー春");
  });
});

describe("isUnsupportedQuestion", () => {
  it("個人情報を含む質問はtrue", () => {
    expect(isUnsupportedQuestion("住所を教えて")).toBe(true);
  });

  it("普通の質問はfalse", () => {
    expect(isUnsupportedQuestion("おすすめのお店は？")).toBe(false);
  });
});

describe("buildErrorResponse", () => {
  const mockCharacters = CONSULT_CHARACTERS.slice(0, 2);

  it("system_errorは nichiyosan が話者", () => {
    const response = buildErrorResponse("system_error", mockCharacters, "エラーです");
    expect(response.turns![0].speakerId).toBe("nichiyosan");
    expect(response.errorCode).toBe("system_error");
    expect(response.retryable).toBe(false);
  });

  it("retryable オプションが反映される", () => {
    const response = buildErrorResponse("system_error", mockCharacters, "エラーです", {
      retryable: true,
    });
    expect(response.retryable).toBe(true);
  });

  it("no_resultは yosakochan が話者", () => {
    const allChars = CONSULT_CHARACTERS;
    const response = buildErrorResponse("no_result", allChars, "見つかりませんでした");
    expect(response.turns![0].speakerId).toBe("yosakochan");
  });
});

describe("buildHistoryContext", () => {
  it("空の履歴はなしと表示", () => {
    const result = buildHistoryContext([], "");
    expect(result).toContain("なし");
  });

  it("履歴が6件を超えると最新6件のみ", () => {
    const history = Array.from({ length: 8 }, (_, i) => ({
      role: "user" as const,
      text: `発言${i}`,
      speakerId: undefined,
      speakerName: undefined,
    }));
    const result = buildHistoryContext(history, "");
    expect(result).toContain("発言7");
    expect(result).not.toContain("発言0");
    expect(result).not.toContain("発言1");
  });
});

describe("isValidFollowUpQuestion", () => {
  it("有効な質問はtrue", () => {
    expect(isValidFollowUpQuestion("おすすめの野菜はありますか？")).toBe(true);
  });

  it("空文字はfalse", () => {
    expect(isValidFollowUpQuestion("")).toBe(false);
  });

  it("短すぎる質問はfalse", () => {
    expect(isValidFollowUpQuestion("野菜？")).toBe(false);
  });

  it("疑問符で終わらない場合はfalse", () => {
    expect(isValidFollowUpQuestion("おすすめの野菜があります")).toBe(false);
  });

  it("NGワードを含む場合はfalse", () => {
    expect(isValidFollowUpQuestion("行ってみるのはどう？")).toBe(false);
  });
});

describe("buildFallbackFollowUpQuestion", () => {
  it("ショップ名がある場合はショップ名を使う", () => {
    const result = buildFallbackFollowUpQuestion("野菜について", "山田農園", 0);
    expect(result).toContain("山田農園");
  });

  it("季節系の質問は季節の質問を返す", () => {
    const result = buildFallbackFollowUpQuestion("旬の野菜を教えて", null, 0);
    expect(result).toContain("季節");
  });

  it("shop数が1以上の場合は人気の店を返す", () => {
    const result = buildFallbackFollowUpQuestion("おすすめは？", null, 3);
    expect(result).toContain("人気");
  });

  it("デフォルトは回り方の質問", () => {
    const result = buildFallbackFollowUpQuestion("何か教えて", null, 0);
    expect(result).toContain("おすすめ");
  });
});
