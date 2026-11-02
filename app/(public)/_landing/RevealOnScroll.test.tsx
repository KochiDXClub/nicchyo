import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RevealOnScroll from "./RevealOnScroll";
describe("最初の画面のSSR", () => {
  it("JavaScript実行前も見出しと写真を隠さない", () => {
    const html = renderToStaticMarkup(<RevealOnScroll when="enter"><h1>日曜市のデジタルマップ</h1></RevealOnScroll>);
    expect(html).toContain("opacity-100");
    expect(html).not.toContain("opacity-0");
    expect(html).toContain("landing-enter");
  });
});
