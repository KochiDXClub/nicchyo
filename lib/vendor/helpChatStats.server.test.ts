import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/analytics/visitorStats.server", () => ({
  fetchWeeklyVisitors: async () => 120,
  fetchMonthlyVisitors: async () => {
    throw new Error("down");
  },
}));

import { loadVendorHelpMarketStats, loadVendorHelpShopStats } from "./helpChatStats.server";

type Response = { data?: unknown; count?: number; error?: unknown };

/** 表ごとに返事を決めた、つなげて呼べる Supabase の代わり */
function fakeClient(responses: Record<string, Response | ((filters: string[]) => Response)>) {
  return {
    from(table: string) {
      const filters: string[] = [];
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push(`${column}=${String(value)}`);
          return builder;
        },
        gte: (column: string) => {
          filters.push(`${column}>=`);
          return builder;
        },
        order: () => builder,
        limit: () => builder,
        then(resolve: (value: Response) => void) {
          const entry = responses[table];
          resolve(typeof entry === "function" ? entry(filters) : (entry ?? { data: [] }));
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

describe("loadVendorHelpShopStats", () => {
  it("AI 相談で話題になった回数・言葉、ハート、自分の売れ数をまとめる", async () => {
    const supabase = fakeClient({
      ai_consult_logs: {
        data: [
          { keywords: ["トマト", "甘い"], is_recommendation: true },
          { keywords: ["トマト"], is_recommendation: false },
        ],
      },
      content_reactions: (filters) => ({ count: filters.includes("created_at>=") ? 2 : 9 }),
      product_sales: {
        data: [
          { product_name: "トマト", quantity: 3 },
          { product_name: "なす", quantity: 5 },
          { product_name: "トマト", quantity: 4 },
        ],
      },
    });

    const stats = await loadVendorHelpShopStats(supabase, "v1");

    expect(stats.aiMentions).toEqual({ total: 2, recommended: 1, topKeywords: ["トマト", "甘い"] });
    expect(stats.hearts).toEqual({ thisWeek: 2, total: 9 });
    expect(stats.topSales).toEqual([
      { name: "トマト", quantity: 7 },
      { name: "なす", quantity: 5 },
    ]);
  });

  it("読めなかった項目は空にして、相談は止めない", async () => {
    const supabase = fakeClient({
      ai_consult_logs: { error: { message: "denied" } },
      content_reactions: { error: { message: "denied" } },
      product_sales: { error: { message: "denied" } },
    });

    expect(await loadVendorHelpShopStats(supabase, "v1")).toEqual({
      aiMentions: null,
      hearts: null,
      topSales: [],
    });
  });
});

describe("loadVendorHelpMarketStats", () => {
  it("来訪者数・よく検索された言葉（1文字は数えない）・よく売れている商品をまとめる", async () => {
    const supabase = fakeClient({
      product_search_logs: {
        data: [{ keyword: "いも天" }, { keyword: " いも天" }, { keyword: "あ" }, { keyword: "トマト" }],
      },
      product_sales: {
        data: [
          { product_name: "いも天", quantity: 10 },
          { product_name: "トマト", quantity: 2 },
        ],
      },
    });

    expect(await loadVendorHelpMarketStats(supabase)).toEqual({
      weeklyVisitors: 120,
      monthlyVisitors: null,
      topSearchKeywords: ["いも天", "トマト"],
      topSellingProducts: ["いも天", "トマト"],
    });
  });
});
