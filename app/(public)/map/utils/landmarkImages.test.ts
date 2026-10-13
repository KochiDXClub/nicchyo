import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import landmarks from "../data/landmarks.json";
import type { Landmark } from "../types/landmark";
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
  it("建物画像の PNG は WebP に差し替える", () => {
    expect(withOptimizedLandmarkImage(base).url).toBe("/images/maps/elements/buildings/KochiCastle.webp");
  });

  it("URL 以外は変えない", () => {
    const { url: _url, ...rest } = withOptimizedLandmarkImage(base);
    const { url: _baseUrl, ...baseRest } = base;
    expect(rest).toEqual(baseRest);
  });

  it("建物画像でない URL はそのまま返す", () => {
    const svg = { ...base, url: "/images/maps/elements/transit/tram-stop.svg" };
    expect(withOptimizedLandmarkImage(svg)).toBe(svg);
  });

  it("すでに WebP の URL はそのまま返す", () => {
    const webp = { ...base, url: "/images/maps/elements/buildings/KochiCastle.webp" };
    expect(withOptimizedLandmarkImage(webp)).toBe(webp);
  });

  it("DB の建物画像（landmarks.json）はすべて public/ に存在する", () => {
    for (const { url } of landmarks as Array<{ url: string }>) {
      const resolved = withOptimizedLandmarkImage({ ...base, url }).url;
      expect(existsSync(resolve("public", `.${resolved}`)), resolved).toBe(true);
    }
  });
});
