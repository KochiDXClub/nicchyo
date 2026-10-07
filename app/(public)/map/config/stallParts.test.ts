import { describe, expect, it } from "vitest";
import {
  STALL_PHOTO_HEIGHT_RATIO,
  STALL_PHOTO_TOP_TRIM,
  generateStallSpriteSvg,
  resolveStallParts,
} from "./stallParts";

const colors = { roof: "#e11d48", awningBase: "#fecdd3", awningStripe: "#e11d48" };
const size = { width: 60, height: 60 };

describe("generateStallSpriteSvg", () => {
  it("写真なしは従来どおり全体の viewBox で、カウンターを描く", () => {
    const svg = generateStallSpriteSvg(resolveStallParts(), colors, size);
    expect(svg).toContain('viewBox="0 0 100 100"');
    expect(svg).toContain('fill="#ec9a0c"');
    expect(svg).not.toContain("<image");
  });

  it("写真ありは本体に写真をはめ込み、縁をカテゴリ色にして、上の余白を切り落とす", () => {
    const svg = generateStallSpriteSvg(
      resolveStallParts(),
      { ...colors, photo: { href: "data:image/jpeg;base64,AAAA", stroke: "#0f766e" } },
      size
    );
    expect(svg).toContain(`viewBox="0 ${STALL_PHOTO_TOP_TRIM} 100 ${100 - STALL_PHOTO_TOP_TRIM}"`);
    expect(svg).toContain('<image href="data:image/jpeg;base64,AAAA"');
    expect(svg).toContain('stroke="#0f766e"');
    expect(svg).not.toContain('fill="#ec9a0c"');
  });

  it("写真ありは屋根を縮める。写真なしの屋根は変えない", () => {
    const withPhoto = generateStallSpriteSvg(
      resolveStallParts({ roof: "arch" }),
      { ...colors, photo: { href: "data:,", stroke: "#000" } },
      size
    );
    const without = generateStallSpriteSvg(resolveStallParts({ roof: "arch" }), colors, size);
    expect(withPhoto).toContain("scale(1 0.6)");
    expect(without).not.toContain("scale(1 0.6)");
  });

  it("縦横比は切り落とした余白のぶんだけ縦に詰まる", () => {
    expect(STALL_PHOTO_HEIGHT_RATIO).toBeCloseTo(0.92, 5);
  });
});
