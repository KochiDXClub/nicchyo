import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const insertView = vi.fn();
/** 店番号 → 屋台、屋台に入った出店者、その出店者の配置。表ごとの返り値 */
let locations: { id: string }[] = [];
let assignmentsHere: { vendor_id: string }[] = [];
let assignmentsOfCandidates: { vendor_id: string; location_id: string; market_date: string }[] = [];
/** shop_members に、ログイン中のアカウントがその店舗のメンバーとして入っているか */
let isMember = false;

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: () => getUser() } }),
}));

/** select().eq() / select().in() のどちらでも、結果を返す（await できる） */
function query(result: unknown) {
  const chain = { eq: () => chain, in: () => chain, then: (resolve: (value: unknown) => void) => resolve(result) };
  return chain;
}

vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => {
    let assignmentCalls = 0;
    return {
      from: (table: string) => {
        if (table === "shop_page_views") return { insert: (row: unknown) => insertView(row) };
        if (table === "market_locations") return { select: () => query({ data: locations }) };
        if (table === "shop_members") {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: isMember ? { user_id: "u" } : null }) }) }) }) };
        }
        return {
          select: () => query({ data: assignmentCalls++ === 0 ? assignmentsHere : assignmentsOfCandidates }),
        };
      },
    };
  },
}));

import { MAX_SHOP_ID } from "@/lib/shops/route";
import { POST } from "./route";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/analytics/shop-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/analytics/shop-view", () => {
  beforeEach(() => {
    getUser.mockReset().mockResolvedValue({ data: { user: null } });
    insertView.mockReset().mockResolvedValue({ error: null });
    isMember = false;
    locations = [{ id: "loc-5" }];
    assignmentsHere = [{ vendor_id: "vendor-1" }];
    assignmentsOfCandidates = [{ vendor_id: "vendor-1", location_id: "loc-5", market_date: "2026-10-04" }];
  });

  it("店番号が範囲外・整数でなければ 400 で、何も書かない", async () => {
    for (const shopId of [0, MAX_SHOP_ID + 1, 1.5, "5"]) {
      expect((await post({ shopId, source: "map" })).status).toBe(400);
    }
    expect(insertView).not.toHaveBeenCalled();
  });

  it("出店者が決まれば、流入元つきで1行書く", async () => {
    const res = await post({ shopId: 5, source: "search" });
    expect(await res.json()).toEqual({ ok: true });
    expect(insertView).toHaveBeenCalledWith({ vendor_id: "vendor-1", source: "search" });
  });

  it("流入元が3つ以外なら direct にする", async () => {
    await post({ shopId: 5, source: "twitter" });
    expect(insertView).toHaveBeenCalledWith({ vendor_id: "vendor-1", source: "direct" });
  });

  it("店舗のメンバーが自分のお店を開いた分は数えない（応答は同じ）。アカウントの ID が店舗の ID と違っても同じ", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "member-account-9" } } });
    isMember = true;
    const res = await post({ shopId: 5, source: "map" });
    expect(await res.json()).toEqual({ ok: true });
    expect(insertView).not.toHaveBeenCalled();
  });

  it("ログインしていても、その店舗のメンバーでなければ数える（アカウントの ID が店舗の ID と同じ値でも、メンバーでなければ除かない）", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "vendor-1" } } });
    isMember = false;
    await post({ shopId: 5, source: "map" });
    expect(insertView).toHaveBeenCalledWith({ vendor_id: "vendor-1", source: "map" });
  });

  it("出店者が引けない・決まらないときは、何も書かない", async () => {
    locations = [];
    expect(await (await post({ shopId: 5, source: "map" })).json()).toEqual({ ok: true });

    locations = [{ id: "loc-5" }];
    assignmentsHere = [];
    await post({ shopId: 5, source: "map" });

    // 出店者の最新の配置がもう別の屋台にある（古い配置が残っているだけ）
    assignmentsHere = [{ vendor_id: "vendor-1" }];
    assignmentsOfCandidates = [
      { vendor_id: "vendor-1", location_id: "loc-5", market_date: "2026-09-27" },
      { vendor_id: "vendor-1", location_id: "loc-9", market_date: "2026-10-04" },
    ];
    await post({ shopId: 5, source: "map" });

    expect(insertView).not.toHaveBeenCalled();
  });
});
