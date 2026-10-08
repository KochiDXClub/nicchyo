import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const notifInsert = vi.fn();

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => ({
    from: (table: string) =>
      table === "reports"
        ? { insert: (row: unknown) => ({ select: () => ({ single: () => insert(row) }) }) }
        : { insert: (row: unknown) => notifInsert(row) },
  }),
}));

import { POST } from "./route";

const valid = { target_type: "vendor", target_id: "001", target_name: "山田農園", reason: "誤った情報", details: "" };

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("https://nicchyo.example/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "https://nicchyo.example", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  insert.mockResolvedValue({ data: { id: "r1" }, error: null });
  notifInsert.mockResolvedValue({ error: null });
});

describe("POST /api/reports", () => {
  it("店舗コードでの通報を保存して通知する", async () => {
    expect((await post(valid)).status).toBe(200);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(notifInsert).toHaveBeenCalledTimes(1);
  });

  it("UUID の target_id も受け付ける", async () => {
    expect((await post({ ...valid, target_id: "00000000-0000-4000-8000-00000000000a" })).status).toBe(200);
  });

  it("不正な JSON は 400", async () => {
    expect((await post("{oops")).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("target_id が長すぎる・記号入りなら 400", async () => {
    expect((await post({ ...valid, target_id: "a".repeat(65) })).status).toBe(400);
    expect((await post({ ...valid, target_id: "1; drop table" })).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("文字列でない項目は 400", async () => {
    expect((await post({ ...valid, details: { a: 1 } })).status).toBe(400);
  });

  it("別オリジンからは 403", async () => {
    expect((await post(valid, { origin: "https://evil.example" })).status).toBe(403);
  });

  it("honeypot に値があれば成功を装って何も保存しない", async () => {
    const res = await post({ ...valid, website: "x" });
    expect(res.status).toBe(200);
    expect(insert).not.toHaveBeenCalled();
    expect(notifInsert).not.toHaveBeenCalled();
  });
});
