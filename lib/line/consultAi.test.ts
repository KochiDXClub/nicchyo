import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getKeywordQuickResponse,
  generateLineConsultReply,
} from "./consultAi";

describe("getKeywordQuickResponse", () => {
  it("マップ関連キーワードに即時回答する", () => {
    expect(getKeywordQuickResponse("マップ")).toContain("日曜市マップはこちらから");
    expect(getKeywordQuickResponse("地図")).toContain("日曜市マップはこちらから");
    expect(getKeywordQuickResponse("map")).toContain("日曜市マップはこちらから");
  });

  it("施設関連キーワードに即時回答する", () => {
    expect(getKeywordQuickResponse("トイレ")).toContain("最寄りのトイレやベンチ");
    expect(getKeywordQuickResponse("お手洗い")).toContain("最寄りのトイレやベンチ");
    expect(getKeywordQuickResponse("ベンチ")).toContain("最寄りのトイレやベンチ");
  });

  it("近況やストーリー関連キーワードに即時回答する", () => {
    expect(getKeywordQuickResponse("近況")).toContain("出店者の近況スナップを見る");
    expect(getKeywordQuickResponse("ストーリー")).toContain("出店者の近況スナップを見る");
  });

  it("カレンダー・雨天中止関連キーワードに即時回答する", () => {
    expect(getKeywordQuickResponse("カレンダー")).toContain("日曜市カレンダーを見る");
    expect(getKeywordQuickResponse("開催")).toContain("日曜市カレンダーを見る");
    expect(getKeywordQuickResponse("中止")).toContain("日曜市カレンダーを見る");
  });

  it("協賛・支援関連キーワードに即時回答する", () => {
    expect(getKeywordQuickResponse("協賛")).toContain("協賛・ご支援ページ");
    expect(getKeywordQuickResponse("支援")).toContain("協賛・ご支援ページ");
  });

  it("挨拶に温かい土佐弁で即時回答する", () => {
    expect(getKeywordQuickResponse("こんにちは")).toContain("にちよさんやきね");
    expect(getKeywordQuickResponse("おはよう")).toContain("にちよさんやきね");
  });

  it("マッチしない質問には null を返す", () => {
    expect(getKeywordQuickResponse("おすすめの朝ごはんある？")).toBeNull();
  });
});

describe("generateLineConsultReply", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1文字以下の超短文には案内を返す", async () => {
    const res = await generateLineConsultReply("あ");
    expect(res.type).toBe("text");
    expect(res.text).toContain("なんでも聞いてや");
  });

  it("キーワードにマッチした場合は即時テキストを返す", async () => {
    const res = await generateLineConsultReply("マップ");
    expect(res.type).toBe("text");
    expect(res.text).toContain("日曜市マップはこちらから");
    expect(res.quickReply?.items.length).toBeGreaterThan(0);
  });
});
