import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Landmark } from "../types/landmark";
import optimizedLandmarkImages from "../data/optimizedLandmarkImages.json";
import { withOptimizedLandmarkImage } from "./landmarkImages";

const base: Landmark = {
  key: "castle",
  name: "高知城",
  description: "",
  url: "/images/maps/elements/buildings/KochiCastle.png",
  lat: 33.56,
  lng: 133.53,
  widthPx: 358.4,
  heightPx: 238.9,
  showAtMinZoom: true,
};

describe("withOptimizedLandmarkImage", () => {
  it("対応表にある PNG は WebP に差し替える", () => {
    expect(withOptimizedLandmarkImage(base).url).toBe("/images/maps/elements/buildings/KochiCastle.webp");
  });

  it("URL 以外は変えない", () => {
    const { url: _url, ...rest } = withOptimizedLandmarkImage(base);
    const { url: _baseUrl, ...baseRest } = base;
    expect(rest).toEqual(baseRest);
  });

  it("対応表に無い URL はそのまま返す", () => {
    const svg = { ...base, url: "/images/maps/elements/transit/tram-stop.svg" };
    expect(withOptimizedLandmarkImage(svg)).toBe(svg);
  });

  it("対応表の WebP はすべて public/ に存在する", () => {
    for (const webp of Object.values(optimizedLandmarkImages)) {
      expect(existsSync(resolve("public", `.${webp}`)), webp).toBe(true);
    }
  });
});
