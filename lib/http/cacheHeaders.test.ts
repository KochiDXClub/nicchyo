import { describe, expect, it } from "vitest";
import { publicCacheHeaders } from "./cacheHeaders";

describe("publicCacheHeaders", () => {
  it("CDN の秒数だけでも作れる", () => {
    expect(publicCacheHeaders({ sMaxAgeSeconds: 60 })).toEqual({ "Cache-Control": "public, s-maxage=60" });
  });

  it("ブラウザの秒数と、更新しながら返す秒数も足せる", () => {
    expect(
      publicCacheHeaders({ maxAgeSeconds: 60, sMaxAgeSeconds: 300, staleWhileRevalidateSeconds: 3600 })
    ).toEqual({ "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600" });
  });
});
