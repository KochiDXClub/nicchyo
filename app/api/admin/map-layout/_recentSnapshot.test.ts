import { beforeEach, describe, expect, it, vi } from "vitest";

const createdSnapshots: unknown[] = [];
let recentRows: { id: string }[] = [];
const filters: [string, unknown][] = [];

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/adminClient", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/app/(public)/map/services/landmarksDb", () => ({ fetchLandmarksFromDb: async () => [] }));
vi.mock("@/app/(public)/map/services/mapRouteDb", () => ({ fetchMapRouteFromDb: async () => ({ config: {} }) }));

import { ensureRecentMapLayoutSnapshot } from "./_shared";

const empty = (data: unknown[] = []) => {
  const chain: Record<string, unknown> = {
    select: () => chain,
    order: () => chain,
    eq: () => chain,
    then: (resolve: (v: unknown) => void) => resolve({ data, error: null }),
  };
  return chain;
};

// サーバー側（RLS）クライアント: 店番・地図の読み取りは空でよい
const supabase = { from: () => empty() } as never;

function adminClient() {
  return {
    from: (table: string) => {
      if (table !== "map_layout_snapshots") return empty();
      return {
        select: () => ({
          eq: (column: string, value: unknown) => (
            filters.push([column, value]),
            {
              gte: (c: string, v: unknown) => (
                filters.push([c, v]),
                { limit: async () => ({ data: recentRows, error: null }) }
              ),
            }
          ),
        }),
        insert: async (row: unknown) => (createdSnapshots.push(row), { error: null }),
      };
    },
  } as never;
}

beforeEach(() => {
  createdSnapshots.length = 0;
  filters.length = 0;
  recentRows = [];
});

describe("ensureRecentMapLayoutSnapshot", () => {
  const now = new Date("2026-10-11T00:00:00Z");

  it("同じ運営の直近のスナップショットがあれば、新しく作らない", async () => {
    recentRows = [{ id: "s1" }];
    const created = await ensureRecentMapLayoutSnapshot(supabase, adminClient(), "admin-1", { updatedShopCount: 1 }, 10, now);
    expect(created).toBe(false);
    expect(createdSnapshots).toHaveLength(0);
    // 条件: この運営が、10 分前より後に作ったもの
    expect(filters).toContainEqual(["created_by", "admin-1"]);
    expect(filters).toContainEqual(["created_at", "2026-10-10T23:50:00.000Z"]);
  });

  it("なければ作る", async () => {
    const created = await ensureRecentMapLayoutSnapshot(supabase, adminClient(), "admin-1", { updatedShopCount: 1 }, 10, now);
    expect(created).toBe(true);
    expect(createdSnapshots).toHaveLength(1);
  });
});
