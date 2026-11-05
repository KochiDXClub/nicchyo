import { beforeEach, describe, expect, it, vi } from "vitest";

const eq = vi.fn();
const logAdminAudit = vi.fn();
const authorizeCity = vi.fn();

vi.mock("@/lib/auth/requireCityApi", () => ({ requireCityApi: () => authorizeCity() }));
vi.mock("@/lib/auth/requireAdminApi", () => ({ requireAdminApi: vi.fn() }));
vi.mock("@/lib/audit/logAdminAudit", () => ({ logAdminAudit: (...a: unknown[]) => logAdminAudit(...a) }));

import { listAnnouncements } from "./announcementRoutes.server";

function client() {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "order"]) q[m] = () => q;
  q.eq = (...a: unknown[]) => {
    eq(...a);
    return q;
  };
  q.limit = async () => ({ data: [], error: null });
  return { from: () => q };
}

beforeEach(() => vi.clearAllMocks());

describe("高知市のサイト内お知らせの一覧", () => {
  it("高知市の担当者は、自分の投稿だけ", async () => {
    authorizeCity.mockResolvedValue({ user: { id: "u1" }, role: "city_official", adminClient: client() });
    const res = await listAnnouncements("city");
    expect(res.status).toBe(200);
    expect(eq).toHaveBeenCalledWith("created_by", "u1");
  });

  it("運営（admin）は、高知市の入口からでも全件", async () => {
    authorizeCity.mockResolvedValue({ user: { id: "a1" }, role: "admin", adminClient: client() });
    await listAnnouncements("city");
    expect(eq).not.toHaveBeenCalled();
  });
});
