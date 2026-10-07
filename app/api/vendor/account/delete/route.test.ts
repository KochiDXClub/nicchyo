import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedShopMembership } from "@/lib/vendor/shopMembership";

const requireVendorContext = vi.fn();
const deleteUser = vi.fn();
const calls: string[] = [];
let withdrawalStatus = "ok";
let errors: Record<string, boolean> = {};

vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/vendor/shopContext.server", () => ({
  requireVendorContext: (...args: unknown[]) => requireVendorContext(...args),
}));

/** どの操作が、どの順番で呼ばれたかを calls に残す。await すると結果（エラーの有無）を返す */
function op(name: string, extra?: unknown) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const key of ["eq", "neq", "is", "or", "select"]) chain[key] = self;
  chain.then = (resolve: (value: unknown) => void) => {
    calls.push(name);
    resolve(extra ?? { error: errors[name] ? { message: "boom" } : null });
  };
  return chain;
}

vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        deleteUser: async (...args: unknown[]) => {
          calls.push("deleteUser");
          return deleteUser(...args);
        },
      },
    },
    rpc: async (name: string) => {
      calls.push(name);
      return errors[name] ? { data: null, error: { message: "boom" } } : { data: withdrawalStatus, error: null };
    },
    from: (table: string) => {
      if (table === "vendor_activity_logs") {
        return {
          update: () => op("anonymize-logs"),
          insert: async () => {
            calls.push("final-log");
            return { error: null };
          },
        };
      }
      if (table === "inquiries") return { update: () => op("scrub-inquiries") };
      if (table === "reports") return { update: () => op("scrub-reports") };
      throw new Error(`unexpected table: ${table}`);
    },
  }),
}));

import { DELETE } from "./route";

const user = { id: "00000000-0000-4000-8000-000000000001" };
const ctx = (role: "owner" | "member"): unknown => ({
  ok: true,
  user,
  vendorId: "shop-1",
  membership: { vendorId: "shop-1", role, permissions: [], joinedAt: null } satisfies ResolvedShopMembership,
  supabase: {},
});
const withdraw = (body: unknown = { confirm: true }) =>
  DELETE(
    new Request("http://localhost/api/vendor/account/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  withdrawalStatus = "ok";
  errors = {};
  deleteUser.mockResolvedValue({ error: null });
  requireVendorContext.mockResolvedValue(ctx("member"));
});

describe("DELETE /api/vendor/account/delete（退会）", () => {
  it("確認（confirm: true）がなければ何もしない", async () => {
    expect((await withdraw({})).status).toBe(400);
    expect((await withdraw({ confirm: false })).status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("メンバーは、操作ログから名前を消してからアカウントを消す（氏名・招待には触れない）", async () => {
    const res = await withdraw();

    expect(res.status).toBe(200);
    expect(calls).toEqual(["anonymize-logs", "scrub-inquiries", "scrub-reports", "deleteUser", "final-log"]);
    expect(deleteUser).toHaveBeenCalledWith(user.id);
  });

  it("ほかにメンバーがいる代表者は、先に引き継ぐよう 409。何も消さない", async () => {
    requireVendorContext.mockResolvedValue(ctx("owner"));
    withdrawalStatus = "has_members";

    const res = await withdraw();

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("owner_has_members");
    expect(calls).toEqual(["begin_owner_withdrawal"]);
  });

  it("自分だけの代表者は、店舗の行を締めた 1 つの処理で氏名と招待を片付けてから、アカウントを消す（アカウントを消すのが最後）", async () => {
    requireVendorContext.mockResolvedValue(ctx("owner"));

    const res = await withdraw();

    expect(res.status).toBe(200);
    expect(calls).toEqual([
      "begin_owner_withdrawal",
      "anonymize-logs",
      "scrub-inquiries",
      "scrub-reports",
      "deleteUser",
      "final-log",
    ]);
  });

  it("アカウントを消せなかったら 500 で、もう一度できる（最終のログは残さない）", async () => {
    deleteUser.mockResolvedValue({ error: { message: "boom" } });

    expect((await withdraw()).status).toBe(500);
    expect(calls).not.toContain("final-log");
  });

  it("途中の片付けに失敗したら、アカウントは消さない", async () => {
    requireVendorContext.mockResolvedValue(ctx("owner"));
    errors = { begin_owner_withdrawal: true };

    expect((await withdraw()).status).toBe(500);
    expect(calls).not.toContain("deleteUser");
  });

  it("代表者として確認できなかったら（not_owner）、何も消さない", async () => {
    requireVendorContext.mockResolvedValue(ctx("owner"));
    withdrawalStatus = "not_owner";

    expect((await withdraw()).status).toBe(403);
    expect(calls).toEqual(["begin_owner_withdrawal"]);
  });

  it("問い合わせ・通報の連絡先を消せなかったら、アカウントは消さない（user_id が外れる前に消す）", async () => {
    errors = { "scrub-reports": true };

    expect((await withdraw()).status).toBe(500);
    expect(calls).not.toContain("deleteUser");
  });

  it("操作ログの匿名化に失敗したら、アカウントは消さない", async () => {
    errors = { "anonymize-logs": true };

    expect((await withdraw()).status).toBe(500);
    expect(calls).toEqual(["anonymize-logs"]);
  });
});
