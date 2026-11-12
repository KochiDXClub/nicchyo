import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readPublicScheduleData, readScheduleRows } from "./read.server";

it("現場登録ではDBの取得条件に店舗IDを含める", async () => {
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query);
  query.range.mockResolvedValue({ data: [{ id: "a" }], error: null });
  const client = { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient;
  expect(await readScheduleRows(client, "location_assignments", "id,vendor_id", ["id"], "vendor-a")).toEqual([{ id: "a" }]);
  expect(query.eq).toHaveBeenCalledWith("vendor_id", "vendor-a");
});

it("公開予定には必要なテーブルだけを読み、旧配置履歴や店舗名を取得しない", async () => {
  const tables: string[] = [];
  const query = { select: vi.fn(), order: vi.fn(), range: vi.fn().mockResolvedValue({ data: [], error: null }) };
  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  const client = { from: (table: string) => { tables.push(table); return query; } } as unknown as SupabaseClient;
  const data = await readPublicScheduleData(client);
  expect(tables).toEqual(["market_locations", "market_place_memberships", "market_place_membership_periods", "market_place_schedule_rules", "market_place_schedule_overrides"]);
  expect(data.legacyAssignments).toEqual([]);
  expect(data.vendors).toEqual([]);
});
