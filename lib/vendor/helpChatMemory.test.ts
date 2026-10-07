import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearHelpMemory, HELP_MEMORY_TTL_MS, loadHelpMemory, saveHelpMemory, type HelpMemory } from "./helpChatMemory";

const memory: HelpMemory = {
  question: "写真を変えたい",
  answer: "「お店の情報」から変えられるよ。",
  proposal: null,
  history: [
    { role: "user", text: "写真を変えたい" },
    { role: "assistant", text: "「お店の情報」から変えられるよ。" },
  ],
};
const T0 = 1_700_000_000_000;

beforeEach(() => window.sessionStorage.clear());

describe("helpChatMemory", () => {
  it("10 分のあいだは、最後の質問・答え・やりとりを読み出せる", () => {
    saveHelpMemory("u1", memory, T0);
    expect(loadHelpMemory("u1", T0 + HELP_MEMORY_TTL_MS - 1)).toEqual(memory);
  });

  it("10 分たったら読み出せず、覚えていたものも消える", () => {
    saveHelpMemory("u1", memory, T0);
    expect(loadHelpMemory("u1", T0 + HELP_MEMORY_TTL_MS)).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("持ち主ごとに分かれる（別のアカウントには出ない）", () => {
    saveHelpMemory("u1", memory, T0);
    expect(loadHelpMemory("u2", T0)).toBeNull();
  });

  it("まだ確かめていない変更案も、一緒に覚えて読み出せる", () => {
    const withProposal: HelpMemory = { ...memory, proposal: { kind: "change", answer: { id: "hours", start: "7:00", end: "13:00" } } };
    saveHelpMemory("u1", withProposal, T0);
    expect(loadHelpMemory("u1", T0)?.proposal).toEqual({ kind: "change", answer: { id: "hours", start: "7:00", end: "13:00" } });
  });

  it("消すと読み出せない", () => {
    saveHelpMemory("u1", memory, T0);
    clearHelpMemory("u1");
    expect(loadHelpMemory("u1", T0)).toBeNull();
  });

  it("壊れた内容・形の違う内容は読み出さない（変更案が壊れていても答えだけ出す）", () => {
    window.sessionStorage.setItem("vendor-help-memory:u1", "{not json");
    expect(loadHelpMemory("u1", T0)).toBeNull();

    window.sessionStorage.setItem("vendor-help-memory:u1", JSON.stringify({ savedAt: T0, question: "", answer: "あ" }));
    expect(loadHelpMemory("u1", T0)).toBeNull();

    window.sessionStorage.setItem(
      "vendor-help-memory:u1",
      JSON.stringify({ savedAt: T0, question: "q", answer: "a", proposal: "壊れた案", history: [{ role: "x", text: 1 }, { role: "user", text: "ok" }] }),
    );
    expect(loadHelpMemory("u1", T0)).toEqual({ question: "q", answer: "a", proposal: null, history: [{ role: "user", text: "ok" }] });
  });

  it("sessionStorage が使えない環境でも、投げずに何も覚えない", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => saveHelpMemory("u1", memory, T0)).not.toThrow();
    spy.mockRestore();
    expect(loadHelpMemory("u1", T0)).toBeNull();
  });
});
