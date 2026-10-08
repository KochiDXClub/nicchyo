import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gte = vi.fn();
const lte = vi.fn();

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        gte: (col: string, value: string) => {
          gte(col, value);
          return {
            lte: (c: string, v: string) => {
              lte(c, v);
              return Promise.resolve({
                data: [{ visitor_count: 3 }, { visitor_count: 4 }],
                error: null,
              });
            },
          };
        },
      }),
    }),
  }),
}));

import { fetchMonthlyVisitors, fetchWeeklyVisitors } from "./visitorStats.server";

describe("visitorStats（JST の週・月の境界）", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.useFakeTimers();
    gte.mockClear();
    lte.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("JST 月曜 00:30（UTC では日曜）は、その月曜から数える", async () => {
    vi.setSystemTime(new Date("2026-10-04T15:30:00Z")); // JST 2026-10-05 月曜
    expect(await fetchWeeklyVisitors()).toBe(7);
    expect(gte).toHaveBeenCalledWith("visit_date", "2026-10-05");
    expect(lte).toHaveBeenCalledWith("visit_date", "2026-10-05");
  });

  it("JST 日曜 23:30（UTC では日曜 14:30）は、直前の月曜から数える", async () => {
    vi.setSystemTime(new Date("2026-10-11T14:30:00Z")); // JST 2026-10-11 日曜
    await fetchWeeklyVisitors();
    expect(gte).toHaveBeenCalledWith("visit_date", "2026-10-05");
    expect(lte).toHaveBeenCalledWith("visit_date", "2026-10-11");
  });

  it("JST で月が替わった直後は、新しい月の1日から数える", async () => {
    vi.setSystemTime(new Date("2026-10-31T15:10:00Z")); // JST 2026-11-01
    await fetchMonthlyVisitors();
    expect(gte).toHaveBeenCalledWith("visit_date", "2026-11-01");
  });
});
