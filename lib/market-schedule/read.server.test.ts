import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readScheduleRows } from "./read.server";

describe("配置履歴の取得", () => {
  it("現場登録ではDBの取得条件に店舗IDを含める", async () => {
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query);
    query.range.mockResolvedValue({ data: [{ id: "a" }], error: null });
    const client = { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient;
    expect(await readScheduleRows(client, "location_assignments", "id,vendor_id", ["id"], "vendor-a")).toEqual([{ id: "a" }]);
    expect(query.eq).toHaveBeenCalledWith("vendor_id", "vendor-a");
  });
});
