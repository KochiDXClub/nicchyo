import { describe, it, expect } from "vitest";
import {
  toDateKey,
  createEmptySession,
  restoreSession,
  buildHistoryForRequest,
  pickSuggestions,
  type ConsultEntry,
} from "./consultSession";

const entry = (id: string, over: Partial<ConsultEntry> = {}): ConsultEntry => ({
  id,
  question: `質問${id}`,
  answer: `答え${id}`,
  ...over,
});

describe("toDateKey", () => {
  it("YYYY-MM-DD にゼロ埋めする", () => {
    expect(toDateKey(new Date(2026, 0, 4))).toBe("2026-01-04");
  });
});

describe("restoreSession", () => {
  const now = new Date(2026, 8, 6);

  it("保存が無ければ空のセッション", () => {
    expect(restoreSession(null, now).entries).toEqual([]);
  });

  it("同じ日の保存は復元する", () => {
    const raw = JSON.stringify({ dateKey: "2026-09-06", entries: [entry("1")] });
    expect(restoreSession(raw, now).entries).toHaveLength(1);
  });

  it("日付が変わっていたら畳んで空にする", () => {
    const raw = JSON.stringify({ dateKey: "2026-08-30", entries: [entry("1")] });
    const restored = restoreSession(raw, now);
    expect(restored.entries).toEqual([]);
    expect(restored.dateKey).toBe("2026-09-06");
  });

  it("壊れたJSONでも落ちない", () => {
    expect(restoreSession("{壊れてる", now).entries).toEqual([]);
  });

  it("entries が配列でなければ空にする", () => {
    const raw = JSON.stringify({ dateKey: "2026-09-06", entries: "だめ" });
    expect(restoreSession(raw, now).entries).toEqual([]);
  });

  it("形の合わない要素は捨てる", () => {
    const raw = JSON.stringify({
      dateKey: "2026-09-06",
      entries: [entry("1"), { id: 2 }, null],
    });
    expect(restoreSession(raw, now).entries).toHaveLength(1);
  });
});

describe("buildHistoryForRequest", () => {
  it("新しい順の保持を、古い順の履歴へ戻す", () => {
    const history = buildHistoryForRequest([entry("2"), entry("1")]);
    expect(history.map((h) => h.text)).toEqual(["質問1", "答え1", "質問2", "答え2"]);
  });

  it("user と assistant が交互になる", () => {
    const history = buildHistoryForRequest([entry("1")]);
    expect(history.map((h) => h.role)).toEqual(["user", "assistant"]);
  });

  it("往復数の上限を超えたら古いものを落とす", () => {
    const entries = ["5", "4", "3", "2", "1"].map((id) => entry(id));
    expect(buildHistoryForRequest(entries, 2)).toHaveLength(4);
  });

  it("履歴が無ければ空", () => {
    expect(buildHistoryForRequest([])).toEqual([]);
  });
});

describe("pickSuggestions", () => {
  const pool = ["A", "B", "C", "D", "E"] as const;

  it("履歴が無ければプールから指定数を返す", () => {
    expect(pickSuggestions({ entries: [], pool })).toHaveLength(3);
  });

  it("直前の答えの続きの質問を先頭に置く", () => {
    const entries = [entry("1", { followUpQuestion: "続きの質問" })];
    expect(pickSuggestions({ entries, pool })[0]).toBe("続きの質問");
  });

  it("すでに聞いた質問は出さない", () => {
    const entries = [entry("1", { question: "A" })];
    expect(pickSuggestions({ entries, pool })).not.toContain("A");
  });

  it("すでに聞いた続きの質問は先頭に置かない", () => {
    const entries = [entry("1", { question: "済んだ質問", followUpQuestion: "済んだ質問" })];
    expect(pickSuggestions({ entries, pool })).not.toContain("済んだ質問");
  });

  it("同じ入力なら毎回同じ並びになる（押し間違い防止）", () => {
    const entries = [entry("1")];
    expect(pickSuggestions({ entries, pool })).toEqual(pickSuggestions({ entries, pool }));
  });

  it("プールを聞き尽くしても落ちない", () => {
    const entries = pool.map((question, index) => entry(`${index}`, { question }));
    expect(pickSuggestions({ entries, pool })).toEqual([]);
  });

  it("重複を返さない", () => {
    const picked = pickSuggestions({ entries: [], pool, count: 5 });
    expect(new Set(picked).size).toBe(picked.length);
  });
});

describe("createEmptySession", () => {
  it("今日の日付を持つ", () => {
    expect(createEmptySession(new Date(2026, 8, 6)).dateKey).toBe("2026-09-06");
  });
});
