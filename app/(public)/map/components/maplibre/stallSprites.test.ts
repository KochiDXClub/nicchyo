import { describe, expect, it } from "vitest";
import { withSvgSize } from "./stallSprites";

describe("withSvgSize", () => {
  it("width / height を差し替え、xmlns を補う", () => {
    const out = withSvgSize('<svg viewBox="0 0 10 10" width="10" height="10"><rect/></svg>', 60);
    expect(out).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="60" height="60"><rect/></svg>');
  });

  it("viewBox が無く width / height だけなら、元の大きさから viewBox を補う", () => {
    const out = withSvgSize('<svg width="120" height="80"><rect/></svg>', 60);
    expect(out).toContain('viewBox="0 0 120 80"');
    expect(out).toContain('width="60" height="60"');
  });

  it("viewBox も大きさも無ければ viewBox は補わない", () => {
    expect(withSvgSize("<svg><rect/></svg>", 60)).not.toContain("viewBox");
  });

  it("単位が % の width / height からは viewBox を補わない", () => {
    expect(withSvgSize('<svg width="100%" height="100%"><rect/></svg>', 60)).not.toContain("viewBox");
  });

  it("px 付きの width / height は数値として読む", () => {
    expect(withSvgSize('<svg width="120px" height="80px"></svg>', 60)).toContain('viewBox="0 0 120 80"');
  });

  it("既に xmlns があれば重ねない", () => {
    const out = withSvgSize('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>', 60);
    expect(out.match(/xmlns=/g)).toHaveLength(1);
  });
});
