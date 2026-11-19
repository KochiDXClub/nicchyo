import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), single: vi.fn(), cache: new Map<string, boolean>() }));
vi.mock("@/lib/supabase/adminClient", () => ({ createAdminClient: mocks.admin }));
// 成功した戻り値だけを保持し、例外と既存キーの値を区別する。
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<boolean>, keys: string[]) => async () => {
    const key = keys.join(":");
    if (mocks.cache.has(key)) return mocks.cache.get(key)!;
    const result = await fn();
    mocks.cache.set(key, result);
    return result;
  },
  revalidateTag: vi.fn(),
}));
import { readPublicScheduleRollout } from "./rollout.server";

describe("公開予定の設定", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cache.clear();
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
  it("未公開は保存せず、別経路での公開を次の読み取りに反映する", async () => {
    mocks.single.mockResolvedValueOnce({ data: { enabled: false }, error: null })
      .mockResolvedValueOnce({ data: { enabled: true }, error: null });
    await expect(readPublicScheduleRollout()).resolves.toBe(false);
    await expect(readPublicScheduleRollout()).resolves.toBe(true);
    await expect(readPublicScheduleRollout()).resolves.toBe(true);
    expect(mocks.single).toHaveBeenCalledTimes(2);
  });
  it("未公開の後に取得が失敗したら古い値を返さない", async () => {
    mocks.single.mockResolvedValueOnce({ data: { enabled: false }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    await expect(readPublicScheduleRollout()).resolves.toBe(false);
    await expect(readPublicScheduleRollout()).rejects.toThrow();
  });
  it("以前のキャッシュキーに残った未公開の値を使わない", async () => {
    mocks.cache.set("public-schedule-rollout", false);
    mocks.single.mockResolvedValue({ data: { enabled: true }, error: null });
    await expect(readPublicScheduleRollout()).resolves.toBe(true);
  });
});
