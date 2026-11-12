import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), single: vi.fn() }));
vi.mock("@/lib/supabase/adminClient", () => ({ createAdminClient: mocks.admin }));
// キャッシュの仕組みは Next に任せ、ここでは読み取りの判定だけを見る
vi.mock("next/cache", () => ({ unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn, revalidateTag: vi.fn() }));
import { readPublicScheduleRollout } from "./rollout.server";

describe("公開予定の設定", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const client = { from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }) };
    mocks.admin.mockReturnValue(client);
  });
  it.each(["PGRST205", "42P01"])("移行前のテーブルなし (%s) は旧表示を維持する", async (code) => {
    mocks.single.mockResolvedValue({ data: null, error: { code } });
    await expect(readPublicScheduleRollout()).resolves.toBe(false);
  });
  it("サービスキーがない場合は公開前と決めつけない", async () => {
    mocks.admin.mockReturnValue(null);
    await expect(readPublicScheduleRollout()).rejects.toThrow();
  });
  it("権限・通信エラーでは公開前と決めつけない", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(readPublicScheduleRollout()).rejects.toThrow();
  });
  it("公開設定を読めればその値を返す", async () => {
    mocks.single.mockResolvedValue({ data: { enabled: true }, error: null });
    await expect(readPublicScheduleRollout()).resolves.toBe(true);
  });
});
