import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminApi = vi.fn();
const rpc = vi.fn();
const logAdminAudit = vi.fn();
const insertActivity = vi.fn();
let shopRows: { id: string; shop_name: string }[] = [];

vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/auth/requireAdminApi", () => ({ requireAdminApi: () => requireAdminApi() }));
vi.mock("@/lib/audit/logAdminAudit", () => ({ logAdminAudit: (...args: unknown[]) => logAdminAudit(...args) }));

import { POST } from "./route";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const adminUser = { id: "admin-1", email: "admin@example.com" };

function post(body: unknown) {
  return POST(
    new Request("https://nicchyo.example/api/admin/shop-claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  shopRows = [
    { id: A, shop_name: "山田農園" },
    { id: B, shop_name: "田中商店" },
  ];
  const adminClient = {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (table: string) => {
      if (table === "vendor_activity_logs") return { insert: (rows: unknown) => insertActivity(rows) };
      return {
        select: () => ({
          in: async () => ({ data: shopRows, error: null }),
          eq: () => ({ maybeSingle: async () => ({ data: shopRows[0] }) }),
        }),
      };
    },
  };
  requireAdminApi.mockResolvedValue({ user: adminUser, role: "admin", adminClient });
  insertActivity.mockResolvedValue({ error: null });
  logAdminAudit.mockResolvedValue(undefined);
});

describe("POST /api/admin/shop-claims", () => {
  it("管理者でなければ何もしない", async () => {
    requireAdminApi.mockResolvedValue({ error: new Response(null, { status: 401 }) });

    expect((await post({ action: "issue", vendorIds: [A] })).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("QR を店舗ごとに発行し、URL を返す。DB にはハッシュだけを渡し、店舗の操作ログと監査ログを残す", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null });

    const res = await post({ action: "issue", vendorIds: [A, B, A] });
    const { results } = (await res.json()) as { results: { vendorId: string; status: string; url?: string }[] };

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(2); // 重複した ID は 1 回だけ
    for (const r of results) {
      expect(r.status).toBe("ok");
      expect(r.url).toMatch(/^https:\/\/nicchyo\.example\/claim\/[A-Za-z0-9_-]{20,}$/);
      expect(JSON.stringify(rpc.mock.calls)).not.toContain(r.url!.split("/claim/")[1]);
    }
    expect(rpc.mock.calls[0][0]).toBe("issue_shop_claim_token");
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_created_by: "admin-1" });
    expect(logAdminAudit).toHaveBeenCalledTimes(1);
    expect((insertActivity.mock.calls[0][0] as unknown[]).length).toBe(2);
  });

  it("すでに代表者がいる店舗は発行せず、その結果を返す（ほかの店舗の発行は続ける）", async () => {
    rpc.mockResolvedValueOnce({ data: "already_claimed", error: null }).mockResolvedValueOnce({ data: "ok", error: null });

    const { results } = (await (await post({ action: "issue", vendorIds: [A, B] })).json()) as {
      results: { status: string; url?: string }[];
    };

    expect(results.map((r) => r.status).sort()).toEqual(["already_claimed", "ok"]);
    expect(results.find((r) => r.status === "already_claimed")?.url).toBeUndefined();
    expect((insertActivity.mock.calls[0][0] as unknown[]).length).toBe(1);
  });

  it("入力が不正なら 400（0 件・301 件・uuid でない ID・知らない操作）", async () => {
    const many = Array.from({ length: 301 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    for (const body of [
      { action: "issue", vendorIds: [] },
      { action: "issue", vendorIds: many },
      { action: "issue", vendorIds: ["nope"] },
      { action: "delete", vendorId: A },
    ]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("紐づけの解除は confirm: true がなければ実行しない", async () => {
    expect((await post({ action: "unlink", vendorId: A })).status).toBe(400);
    expect((await post({ action: "unlink", vendorId: A, confirm: false })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("紐づけを解除すると、外れた人数を返し、監査ログと店舗の操作ログを残す", async () => {
    rpc.mockResolvedValue({ data: 3, error: null });

    const res = await post({ action: "unlink", vendorId: A, confirm: true });

    expect(await res.json()).toEqual({ ok: true, removedMembers: 3 });
    expect(rpc).toHaveBeenCalledWith("unlink_shop", { p_vendor_id: A });
    expect(logAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "admin-1" }),
      expect.objectContaining({ action: "shop_claim_unlink", targetId: A }),
    );
    expect(insertActivity.mock.calls[0][0]).toEqual([expect.objectContaining({ vendor_id: A, action: "qr.unlink" })]);
  });

  it("存在しない店舗の解除は 404", async () => {
    rpc.mockResolvedValue({ data: -1, error: null });

    expect((await post({ action: "unlink", vendorId: A, confirm: true })).status).toBe(404);
    expect(logAdminAudit).not.toHaveBeenCalled();
  });
});
