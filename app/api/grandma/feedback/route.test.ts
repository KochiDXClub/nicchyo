// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn(() => {
  throw new Error("入力検証で弾く前に DB へ触ってはいけない");
});

vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => createClient() }));
vi.mock("@/lib/analytics/collectionSettings.server", () => ({ isAnalyticsCollectionEnabled: async () => true }));

import { POST } from "./route";

function post(body: string) {
  return POST(
    new Request("http://localhost/api/grandma/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    })
  );
}

describe("POST /api/grandma/feedback の入力検証", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("壊れた JSON は 500 でなく 400", async () => {
    const res = await post("{broken");
    expect(res.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("形式の違う JSON は 400", async () => {
    expect((await post(JSON.stringify({ rating: 5 }))).status).toBe(400);
  });
});
