import { describe, expect, it } from "vitest";
import type { MapSpot } from "@/lib/spots";
import { buildFacilityMarkerHtml } from "./GuideLayer";

const spot = (overrides: Partial<MapSpot>): MapSpot => ({
  id: "landmark:x",
  kind: "landmark",
  name: "高知城",
  description: "",
  lat: 33.56,
  lng: 133.53,
  accentColor: "#b45309",
  ...overrides,
});

describe("buildFacilityMarkerHtml", () => {
  it("アイコン画像の URL を属性値としてエスケープする（引用符で属性を抜けられない）", () => {
    const html = buildFacilityMarkerHtml(spot({ iconUrl: 'https://example.com/a.png"><a href="x' }), false);
    expect(html).toContain('src="https://example.com/a.png&quot;&gt;&lt;a href=&quot;x"');
    expect(html).not.toContain("<a href");
  });

  it("名前もエスケープする", () => {
    const html = buildFacilityMarkerHtml(spot({ name: "<b>城</b>" }), false);
    expect(html).toContain("&lt;b&gt;城&lt;/b&gt;");
  });
});
