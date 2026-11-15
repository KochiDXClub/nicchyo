import { expect, it } from "vitest";
import type { ShopProfile } from "@/app/(public)/map/types/shopData";
import { nextMarketStatusLabel } from "./marketStatus";

it("未設定・休み・休市を区別し、英語でも表示する", () => {
  const shop = { id: 1001, hasMapLocation: false } as ShopProfile;
  expect(nextMarketStatusLabel({ ...shop, nextMarketStatus: "unknown" })).toBe("次の日曜の出店予定を確認中");
  expect(nextMarketStatusLabel({ ...shop, nextMarketStatus: "not_scheduled" })).toBe("次の日曜は出店予定なし");
  expect(nextMarketStatusLabel({ ...shop, nextMarketStatus: "market_closed" })).toBe("次の日曜市は中止・休み");
  expect(nextMarketStatusLabel({ ...shop, nextMarketStatus: "scheduled" }, "en")).toBe("Scheduled for next Sunday (location to be confirmed)");
});
