import { describe, it, expect, vi, afterEach } from "vitest";
import { logAdminAudit, logAdminAuditBatch } from "./logAdminAudit";

const makeSupabase = (error: { message: string } | null = null) => {
  const insert = vi.fn().mockResolvedValue({ error });
  const client = {
    from: vi.fn().mockReturnValue({ insert }),
  };
  return { client: client as unknown as Parameters<typeof logAdminAudit>[0], insert };
};

describe("logAdminAudit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("admin_audit_logs へ actor・entry の内容をそのまま insert する", async () => {
    const { client, insert } = makeSupabase();

    await logAdminAudit(
      client,
      { id: "user-1", email: "a@example.com", role: "admin" },
      {
        action: "category_created",
        targetType: "category",
        targetId: "cat-1",
        targetName: "野菜",
        details: JSON.stringify({ name: "野菜" }),
        ipAddress: "1.2.3.4",
      }
    );

    expect(insert).toHaveBeenCalledWith({
      actor_id: "user-1",
      actor_email: "a@example.com",
      actor_role: "admin",
      action: "category_created",
      target_type: "category",
      target_id: "cat-1",
      target_name: "野菜",
      details: JSON.stringify({ name: "野菜" }),
      ip_address: "1.2.3.4",
    });
  });

  it("省略可能な項目は null で埋める", async () => {
    const { client, insert } = makeSupabase();

    await logAdminAudit(client, { id: "user-1", role: null }, { action: "clean_map_history" });

    expect(insert).toHaveBeenCalledWith({
      actor_id: "user-1",
      actor_email: null,
      actor_role: null,
      action: "clean_map_history",
      target_type: null,
      target_id: null,
      target_name: null,
      details: null,
      ip_address: null,
    });
  });

  it("insert が失敗しても例外を投げず、console.error にだけ残す", async () => {
    const { client } = makeSupabase({ message: "boom" });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      logAdminAudit(client, { id: "user-1", role: "admin" }, { action: "spot_created" })
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("%s"),
      "spot_created",
      expect.objectContaining({ message: "boom" })
    );
  });

  describe("logAdminAuditBatch", () => {
    it("複数件を1回の insert にまとめて渡す", async () => {
      const { client, insert } = makeSupabase();

      await logAdminAuditBatch(client, { id: "user-1", role: "admin" }, [
        { action: "ai_model_updated", targetId: "case-1" },
        { action: "ai_model_updated", targetId: "case-2" },
      ]);

      expect(insert).toHaveBeenCalledTimes(1);
      expect(insert).toHaveBeenCalledWith([
        expect.objectContaining({ actor_id: "user-1", target_id: "case-1" }),
        expect.objectContaining({ actor_id: "user-1", target_id: "case-2" }),
      ]);
    });

    it("空配列のときは insert を呼ばない", async () => {
      const { client, insert } = makeSupabase();

      await logAdminAuditBatch(client, { id: "user-1", role: "admin" }, []);

      expect(insert).not.toHaveBeenCalled();
    });
  });
});
