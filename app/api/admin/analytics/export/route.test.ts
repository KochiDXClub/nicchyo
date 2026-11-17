import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ requireAdminApi: vi.fn(), logAdminAudit: vi.fn(), range: vi.fn() }));
vi.mock("@/lib/auth/requireAdminApi", () => ({ requireAdminApi: mocks.requireAdminApi }));
vi.mock("@/lib/audit/logAdminAudit", () => ({ logAdminAudit: mocks.logAdminAudit }));
import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  const query = { select: vi.fn(), gte: vi.fn(), lt: vi.fn(), lte: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(), range: mocks.range };
  query.select.mockReturnValue(query); query.gte.mockReturnValue(query); query.lt.mockReturnValue(query); query.lte.mockReturnValue(query); query.order.mockReturnValue(query); query.limit.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: { id: 100 }, error: null });
  mocks.requireAdminApi.mockResolvedValue({ user: { id: "admin" }, role: "admin", adminClient: { from: () => query } });
  mocks.range.mockResolvedValue({ data: [{ id: 1, visit_date: "2026-10-10", path: "/map?q=secret", visitor_key: "secret" }], error: null });
});

describe("analytics export API", () => {
  it("管理者以外を拒否する", async () => {
    mocks.requireAdminApi.mockResolvedValue({ error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    const response = await GET(new NextRequest("https://example.com/api/admin/analytics/export"));
    expect(response.status).toBe(401);
    expect(mocks.range).not.toHaveBeenCalled();
  });
  it("既定で集計のみ返し、識別子やクエリは含めず出力を監査する", async () => {
    const response = await GET(new NextRequest("https://example.com/api/admin/analytics/export"));
    const csv = await response.text();
    expect(response.status).toBe(200);
    expect(csv).toContain("/map");
    expect(csv).not.toContain("secret");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.logAdminAudit).toHaveBeenCalledOnce();
  });
  it("不正な日数と形式を拒否する", async () => {
    const response = await GET(new NextRequest("https://example.com/api/admin/analytics/export?days=NaN&mode=raw"));
    expect(response.status).toBe(400);
    expect(mocks.range).not.toHaveBeenCalled();
  });
});
