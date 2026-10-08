import { describe, expect, it } from "vitest";
import { vendorForStore } from "./shopVendor";

const HERE = new Set(["loc-5"]);

describe("vendorForStore", () => {
  it("自分のいちばん新しい配置がその屋台にある出店者を返す", () => {
    expect(
      vendorForStore(
        [
          { vendor_id: "a", location_id: "loc-5", market_date: "2026-10-04" },
          { vendor_id: "a", location_id: "loc-9", market_date: "2026-09-27" },
        ],
        HERE
      )
    ).toBe("a");
  });

  it("もう別の屋台へ移った出店者は選ばない（古い配置が残っているだけ）", () => {
    expect(
      vendorForStore(
        [
          { vendor_id: "a", location_id: "loc-5", market_date: "2026-09-27" },
          { vendor_id: "a", location_id: "loc-9", market_date: "2026-10-04" },
        ],
        HERE
      )
    ).toBeNull();
  });

  it("同じ屋台に別の出店者が入るなら、最新の配置がここにある側だけを選ぶ", () => {
    expect(
      vendorForStore(
        [
          { vendor_id: "a", location_id: "loc-5", market_date: "2026-09-27" },
          { vendor_id: "b", location_id: "loc-5", market_date: "2026-10-04" },
          { vendor_id: "a", location_id: "loc-9", market_date: "2026-10-04" },
        ],
        HERE
      )
    ).toBe("b");
  });

  it("2人以上に決まるとき・誰もいないときは null（記録しない）", () => {
    expect(
      vendorForStore(
        [
          { vendor_id: "a", location_id: "loc-5", market_date: "2026-10-04" },
          { vendor_id: "b", location_id: "loc-5", market_date: "2026-10-04" },
        ],
        HERE
      )
    ).toBeNull();
    expect(vendorForStore([], HERE)).toBeNull();
  });
});
