import { describe, it, expect } from "vitest";
import { isPatchableStatus, PATCHABLE_STATUSES } from "./_helpers";

describe("isPatchableStatus", () => {
  it("active / hidden は許可する", () => {
    expect(isPatchableStatus("active")).toBe(true);
    expect(isPatchableStatus("hidden")).toBe(true);
    expect(PATCHABLE_STATUSES).toEqual(["active", "hidden"]);
  });

  it("deleted への遷移はここでは許可しない（DELETE経由に限定）", () => {
    expect(isPatchableStatus("deleted")).toBe(false);
  });

  it("未知の値・不正な型は弾く", () => {
    expect(isPatchableStatus("expired")).toBe(false);
    expect(isPatchableStatus("")).toBe(false);
    expect(isPatchableStatus(undefined)).toBe(false);
    expect(isPatchableStatus(null)).toBe(false);
    expect(isPatchableStatus(123)).toBe(false);
    expect(isPatchableStatus({ status: "active" })).toBe(false);
  });
});
