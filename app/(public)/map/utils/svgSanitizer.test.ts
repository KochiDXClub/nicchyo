import { describe, it, expect } from "vitest";
import { sanitizeInlineSvg } from "./svgSanitizer";

const wrap = (inner: string) => `<svg viewBox="0 0 10 10">${inner}</svg>`;

describe("sanitizeInlineSvg", () => {
  it("安全な SVG はそのまま返す", () => {
    const svg = wrap('<path d="M0 0L10 10" fill="red"/>');
    expect(sanitizeInlineSvg(svg)).toBe(svg);
  });

  it("<use> の内部参照（#id）は許可する", () => {
    const svg = wrap('<defs><g id="a"><circle r="1"/></g></defs><use href="#a"/><use xlink:href="#a"/>');
    expect(sanitizeInlineSvg(svg)).toBe(svg);
  });

  it("外部URL・data URL・相対パスの href を拒否する", () => {
    expect(sanitizeInlineSvg(wrap('<use href="https://evil.example/x.svg#a"/>'))).toBeNull();
    expect(sanitizeInlineSvg(wrap('<use xlink:href="//evil.example/x.svg#a"/>'))).toBeNull();
    expect(sanitizeInlineSvg(wrap('<use href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="/>'))).toBeNull();
    expect(sanitizeInlineSvg(wrap('<use href="x.svg#a"/>'))).toBeNull();
    expect(sanitizeInlineSvg(wrap("<use href='https://evil.example/x.svg'/>"))).toBeNull();
  });

  it("クォートなしの href を拒否する", () => {
    expect(sanitizeInlineSvg(wrap("<use href=https://evil.example/x.svg />"))).toBeNull();
  });

  it("属性値内の > で検査を回避できない", () => {
    expect(sanitizeInlineSvg(wrap('<path d="M0 0>" /><use href="https://evil.example/x.svg#a"/>'))).toBeNull();
    expect(sanitizeInlineSvg(wrap('<use class=">" href="https://evil.example/x.svg#a"/>'))).toBeNull();
    expect(sanitizeInlineSvg(wrap('<use class="a>b" xlink:href="data:text/plain,x"/>'))).toBeNull();
  });

  it("大文字小文字を変えた HREF も検査する", () => {
    expect(sanitizeInlineSvg(wrap('<use HREF="https://evil.example/x.svg"/>'))).toBeNull();
  });

  it("script・イベントハンドラ・許可外タグを拒否する", () => {
    expect(sanitizeInlineSvg(wrap("<script>alert(1)</script>"))).toBeNull();
    expect(sanitizeInlineSvg(wrap('<path d="M0 0" onclick="x()"/>'))).toBeNull();
    expect(sanitizeInlineSvg(wrap('<a href="#a"/>'))).toBeNull();
  });
});
