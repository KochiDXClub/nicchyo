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

it("日曜市以外の市の店は、市名と曜日を出し、日曜に出るように読めない", () => {
  const thursday = { id: 1001, hasMapLocation: true, nextMarketStatus: "scheduled", nextMarketLabel: { name: "木曜市", weekday: 4 } } as ShopProfile;
  expect(nextMarketStatusLabel(thursday)).toBe("木曜市（毎週木曜）に出店予定");
  expect(nextMarketStatusLabel({ ...thursday, nextMarketStatus: "not_scheduled" })).toBe("木曜市（毎週木曜）の出店予定なし");
  // 日曜市の店は従来どおり
  expect(nextMarketStatusLabel({ ...thursday, nextMarketLabel: { name: "日曜市", weekday: 0 } })).toBe("次の日曜は出店予定");
  expect(nextMarketStatusLabel({ ...thursday, nextMarketLabel: null })).toBe("次の日曜は出店予定");
});
