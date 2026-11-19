import { describe, expect, it } from "vitest";
import { ANALYTICS_COLLECTION_ITEMS, parseAnalyticsCollectionSettings } from "./collectionSettings";

describe("解析項目の設定", () => {
  it("未設定の項目は既存動作を維持し、明示的な停止を反映する", () => {
    const result = parseAnalyticsCollectionSettings({ searchLogs: false, pageVisits: "false" });
    expect(result.searchLogs).toBe(false);
    expect(result.pageVisits).toBe(true);
    expect(Object.keys(result)).toHaveLength(ANALYTICS_COLLECTION_ITEMS.length);
  });
  it("異常な設定を受けても既存項目以外を増やさない", () => {
    expect(parseAnalyticsCollectionSettings({ extra: false })).not.toHaveProperty("extra");
    expect(Object.values(parseAnalyticsCollectionSettings(null)).every(Boolean)).toBe(true);
  });
});
