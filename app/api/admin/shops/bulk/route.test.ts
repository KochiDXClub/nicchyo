import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminApi = vi.fn();
const deleteVendors = vi.fn();
const updateUserById = vi.fn();
const deleteUser = vi.fn();
let validVendors: { id: string; shop_name: string }[] = [];
let memberRows: { vendor_id: string; user_id: string; role: string }[] = [];

vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null, getClientIp: () => "unknown" }));
vi.mock("@/lib/auth/requireAdminApi", () => ({ requireAdminApi: () => requireAdminApi() }));
vi.mock("@/lib/audit/logAdminAudit", () => ({ logAdminAudit: async () => undefined }));
vi.mock("@/app/(public)/map/services/shopCache", () => ({ revalidatePublicShops: vi.fn() }));

import { POST } from "./route";

const A = "00000000-0000-4000-8000-00000000000a"; // アカウントのある店舗
const B = "00000000-0000-4000-8000-00000000000b"; // アカウントのない店舗（運営が先に作った箱）

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/admin/shops/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  validVendors = [
    { id: A, shop_name: "山田農園" },
    { id: B, shop_name: "田中商店" },
  ];
  memberRows = [
    { vendor_id: A, user_id: "owner-1", role: "owner" },
    { vendor_id: A, user_id: "member-1", role: "member" },
  ];
  deleteVendors.mockResolvedValue({ error: null });
  updateUserById.mockResolvedValue({ error: null });
  deleteUser.mockResolvedValue({ error: { message: "user not found" } });
  const adminClient = {
    auth: { admin: { updateUserById: (...a: unknown[]) => updateUserById(...a), deleteUser: (...a: unknown[]) => deleteUser(...a) } },
    from: (table: string) => {
      if (table === "vendors") {
        return {
          select: () => ({ in: async (_c: string, ids: string[]) => ({ data: validVendors.filter((v) => ids.includes(v.id)), error: null }) }),
          delete: () => ({ in: (_c: string, ids: string[]) => deleteVendors(ids) }),
        };
      }
      // shop_members
      return { select: () => ({ in: async (_c: string, ids: string[]) => ({ data: memberRows.filter((m) => ids.includes(m.vendor_id)), error: null }) }) };
    },
  };
  requireAdminApi.mockResolvedValue({ user: { id: "admin-1", email: "admin@example.com" }, role: "admin", adminClient });
});

describe("POST /api/admin/shops/bulk（アカウントのない店舗）", () => {
  it("削除は、店舗の行を直接消す。店舗の ID でログインアカウントを探さない（アカウントのない店舗でも消せる）", async () => {
    const res = await post({ action: "delete", ids: [A, B], confirmText: "DELETE" });

    expect(res.status).toBe(200);
    expect(deleteVendors).toHaveBeenCalledWith([A, B]);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("削除に失敗したら 207 で、失敗した店舗を返す", async () => {
    deleteVendors.mockResolvedValue({ error: { message: "boom" } });

    const res = await post({ action: "delete", ids: [A, B], confirmText: "DELETE" });

    expect(res.status).toBe(207);
    expect((await res.json()).failedIds).toEqual([A, B]);
  });

  it("停止は、その店舗のメンバー全員のアカウントを止める。アカウントのない店舗は、エラーにせず飛ばす", async () => {
    const res = await post({ action: "suspend", ids: [A, B] });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledTimes(2);
    expect(updateUserById).toHaveBeenCalledWith("owner-1", { ban_duration: "876000h" });
    expect(updateUserById).toHaveBeenCalledWith("member-1", { ban_duration: "876000h" });
    expect(updateUserById).not.toHaveBeenCalledWith(B, expect.anything());
    expect(body).toMatchObject({ ok: true, count: 1, skippedIds: [B] });
  });

  it("復活も同じ。アカウントがないだけの店舗で失敗扱いにしない", async () => {
    const res = await post({ action: "restore", ids: [B] });

    expect(res.status).toBe(200);
    expect(updateUserById).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ ok: true, count: 0, skippedIds: [B] });
  });

  it("アカウントの停止に失敗した店舗だけを 207 で返す", async () => {
    updateUserById.mockResolvedValueOnce({ error: { message: "x" } }).mockResolvedValue({ error: null });

    const res = await post({ action: "suspend", ids: [A, B] });

    expect(res.status).toBe(207);
    expect((await res.json()).failedIds).toEqual([A]);
  });

  it("削除は確認の文字がなければ実行しない", async () => {
    expect((await post({ action: "delete", ids: [A] })).status).toBe(400);
    expect(deleteVendors).not.toHaveBeenCalled();
  });
});
