import { saveContactPrefill, takeContactPrefill } from "./prefill";

describe("問い合わせフォームの本文の受け渡し", () => {
  beforeEach(() => sessionStorage.clear());

  it("置いた本文を一度だけ取り出せる", () => {
    saveContactPrefill("出店料について", 1000);
    expect(takeContactPrefill(2000)).toBe("出店料について");
    expect(takeContactPrefill(2000)).toBeNull();
  });

  it("10分より古いものは使わない", () => {
    saveContactPrefill("古い相談", 0);
    expect(takeContactPrefill(10 * 60 * 1000 + 1)).toBeNull();
  });

  it("1000文字で切る", () => {
    saveContactPrefill("あ".repeat(1200), 0);
    expect(takeContactPrefill(1)).toHaveLength(1000);
  });

  it("壊れた値は無視する", () => {
    sessionStorage.setItem("nicchyo:contact-prefill", "{broken");
    expect(takeContactPrefill()).toBeNull();
  });
});
