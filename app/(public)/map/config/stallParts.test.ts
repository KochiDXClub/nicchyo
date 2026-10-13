import { describe, expect, it } from "vitest";
import {
  STALL_BODY_RECT,
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

  it("写真ありはひさしを描かず、屋根の下に縁飾りを垂らし、脚を短くして、そのぶん写真を上下に広げる", () => {
    const photo = { href: "data:,", stroke: "#000" };
    for (const awning of ["stripe", "plain", "scallop"] as const) {
      const parts = resolveStallParts({ awning });
      const withPhoto = generateStallSpriteSvg(parts, { ...colors, photo }, size);
      const without = generateStallSpriteSvg(parts, colors, size);
      // ひさしの帯（y=28 から始まる形）は写真なしにだけ出る
      expect(without).toMatch(/d="M(8|12),28 /);
      expect(withPhoto).not.toMatch(/d="M(8|12),28 /);
      // 縁飾りはひさしの濃淡を交互に使う
      const fringe = withPhoto.match(/<path d="M[\d.]+,26\.5 H[\d.]+ V30 A[^"]*" fill="[^"]*"\/>/g) ?? [];
      expect(fringe).toHaveLength(7);
      expect(fringe[0]).toContain(`fill="${colors.awningStripe}"`);
      expect(fringe[1]).toContain(`fill="${colors.awningBase}"`);
      expect(without).not.toMatch(/,26\.5 H[\d.]+ V30 A/);
    }
    const svg = generateStallSpriteSvg(resolveStallParts(), { ...colors, photo }, size);
    expect(svg).toContain("M18,88 h7.7 v6 h-7.7 Z");
    expect(svg).not.toContain("v12 h-7.7");
    // 写真の切り抜き（STALL_BODY_RECT）と本体の輪郭が同じ範囲
    expect(svg).toContain('<clipPath id="stall-body-clip"><path d="M16,27 H84 A6,6 0 0 1 90,33 V82 A6,6 0 0 1 84,88 H16');
    const r = STALL_BODY_RECT;
    expect(svg).toContain(`x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}"`);
    // 縮めた屋根の下辺（y≈28〜29）の内側から、短い脚の付け根（y=88）まで写真にする
    expect(r.y).toBeLessThanOrEqual(28);
    expect(r.y + r.height).toBe(88);
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
