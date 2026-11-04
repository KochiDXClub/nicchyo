// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ensureVendorRole } from "./ensureVendorRole.server";

const userWith = (role?: string) =>
  ({ id: "u1", app_metadata: role ? { role } : {} }) as unknown as User;

function fakeDb(error: { message: string } | null = null) {
  const updateUserById = vi.fn(async () => ({ error }));
  return { db: { auth: { admin: { updateUserById } } } as unknown as SupabaseClient, updateUserById };
}

describe("ensureVendorRole", () => {
  it("vendor・admin・moderator・city_official は書き換えない", async () => {
    for (const role of ["vendor", "admin", "moderator", "city_official"]) {
      const { db, updateUserById } = fakeDb();
      expect(await ensureVendorRole(db, userWith(role), "test")).toBe(true);
      expect(updateUserById).not.toHaveBeenCalled();
    }
  });

  it("一般ユーザー・ロール無しは vendor にする", async () => {
    for (const role of ["general_user", undefined]) {
      const { db, updateUserById } = fakeDb();
      expect(await ensureVendorRole(db, userWith(role), "test")).toBe(true);
      expect(updateUserById).toHaveBeenCalledWith("u1", { app_metadata: { role: "vendor" } });
    }
  });

  it("付与に失敗したら false", async () => {
    const { db } = fakeDb({ message: "boom" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await ensureVendorRole(db, userWith("general_user"), "test")).toBe(false);
  });
});
