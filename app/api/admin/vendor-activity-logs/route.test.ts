import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminApi = vi.fn();
const lt = vi.fn();
let rows: unknown[] = [];

vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/auth/requireAdminApi", () => ({ requireAdminApi: () => requireAdminApi() }));

import { GET } from "./route";

const VENDOR = "00000000-0000-4000-8000-00000000000a";
const get = (qs: string) => GET(new Request(`http://localhost/api/admin/vendor-activity-logs?${qs}`));

beforeEach(() => {
  vi.clearAllMocks();
  rows = [{ id: 2, actor_name: null, action: "qr.issue", summary: "運営がQRコードを発行した", created_at: "2026-10-03T05:00:00Z" }];
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.lt = (...args: unknown[]) => (lt(...args), chain);
  chain.then = (resolve: (value: unknown) => void) => resolve({ data: rows, error: null });
  requireAdminApi.mockResolvedValue({ user: { id: "admin-1" }, role: "admin", adminClient: { from: () => chain } });
});

describe("GET /api/admin/vendor-activity-logs", () => {
  it("管理者でなければ読めない", async () => {
    requireAdminApi.mockResolvedValue({ error: new Response(null, { status: 401 }) });

    expect((await get(`vendorId=${VENDOR}`)).status).toBe(401);
  });

  it("店舗の ID（uuid）と日時の形を確かめる", async () => {
    expect((await get("")).status).toBe(400);
    expect((await get("vendorId=nope")).status).toBe(400);
    expect((await get(`vendorId=${VENDOR}&before=yesterday`)).status).toBe(400);
  });

  it("店舗の操作ログを返す。名前が空のもの（運営・退会したメンバー）にも表示名を付ける", async () => {
    const body = await (await get(`vendorId=${VENDOR}`)).json();

    expect(body).toEqual({
      logs: [
        {
          id: 2,
          actorName: "（退会したメンバーなど）",
          action: "qr.issue",
          label: "QRコードを発行（再発行）した",
          summary: "運営がQRコードを発行した",
          createdAt: "2026-10-03T05:00:00Z",
        },
      ],
      hasMore: false,
    });
  });

  it("before を渡すと、それより古い分を読む", async () => {
    await get(`vendorId=${VENDOR}&before=2026-10-03T05:00:00Z`);

    expect(lt).toHaveBeenCalledWith("created_at", "2026-10-03T05:00:00Z");
  });
});
