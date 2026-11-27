import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
const guard = vi.hoisted(() => vi.fn());
const list = vi.hoisted(() => vi.fn());
const insert = vi.hoisted(() => vi.fn());
const audit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/requireAdminApi", () => ({ requireAdminApi: auth }));
vi.mock("@/lib/admin/shopApiGuard", () => ({ guardAdminWrite: guard }));
vi.mock("@/lib/vendor/intention.server", () => ({ listIntentionSeasons: list }));
vi.mock("@/lib/audit/logAdminAudit", () => ({ logAdminAudit: audit }));

import { GET, POST } from "./route";

const adminClient = {
  from: () => ({
    insert: (row: unknown) => {
      insert(row);
      return { select: () => ({ single: async () => ({ data: { season_year: 2027, title: "2027年", opens_on: "2027-01-01", closes_on: "2027-02-28" }, error: null }) }) };
    },
  }),
};
const validBody = { title: "2027年", opensOn: "2027-01-01", closesOn: "2027-02-28" };
const post = (body: unknown = validBody) => {
  guard.mockResolvedValue({ ctx: { adminClient, user: { id: "admin-1", email: null }, role: "admin", ip: null }, body });
  return POST(new Request("https://example.test/api/admin/vendor-intention-seasons", { method: "POST" }));
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "admin-1" }, role: "admin", adminClient });
  list.mockResolvedValue([]);
});

describe("出店意向調査の季節API（運営だけ）", () => {
  it("運営でなければ一覧を読まない（401）", async () => {
    auth.mockResolvedValue({ error: new Response(null, { status: 401 }) });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(list).not.toHaveBeenCalled();
  });

  it("運営でなければ作成せず、DBへ書かない", async () => {
    guard.mockResolvedValue({ error: new Response(null, { status: 401 }) });
    expect((await POST(new Request("https://example.test/api/admin/vendor-intention-seasons", { method: "POST" }))).status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it("運営なら一覧を返す", async () => {
    list.mockResolvedValue([{ seasonYear: 2026, title: "2026年", opensOn: "2026-01-01", closesOn: "2026-02-01" }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).seasons).toHaveLength(1);
  });

  it("締切が開始より前の季節は作らない", async () => {
    const response = await post({ ...validBody, closesOn: "2026-12-31" });
    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("同じ年の季節は作らない（409）", async () => {
    list.mockResolvedValue([{ seasonYear: 2027, title: "既存", opensOn: "2026-12-01", closesOn: "2026-12-10" }]);
    expect((await post()).status).toBe(409);
    expect(insert).not.toHaveBeenCalled();
  });

  it("ほかの季節と受付期間が重なるなら作らない（409）", async () => {
    list.mockResolvedValue([{ seasonYear: 2026, title: "既存", opensOn: "2026-12-20", closesOn: "2027-01-05" }]);
    const response = await post();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("重なって");
    expect(insert).not.toHaveBeenCalled();
  });

  it("正しい入力なら作成し、監査ログを残す", async () => {
    const response = await post();
    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({ season_year: 2027, title: "2027年", opens_on: "2027-01-01", closes_on: "2027-02-28" });
    expect(audit).toHaveBeenCalledWith(adminClient, expect.objectContaining({ id: "admin-1" }), expect.objectContaining({ action: "vendor_intention_season_create" }));
  });
});
