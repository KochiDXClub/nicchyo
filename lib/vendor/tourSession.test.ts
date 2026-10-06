import { beforeEach, describe, expect, it, vi } from "vitest";
import { markToursDismissed, wasTourDismissed } from "./tourSession";

beforeEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("tourSession", () => {
  it("閉じた機能だけを、閉じたこととして覚える", () => {
    markToursDismissed(["home-chat", "home-actions"]);

    expect(wasTourDismissed("home-chat")).toBe(true);
    expect(wasTourDismissed("home-actions")).toBe(true);
    expect(wasTourDismissed("home-calendar")).toBe(false);
  });

  it("sessionStorage が使えなくても、例外にせず「閉じていない」とする", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => markToursDismissed(["home-chat"])).not.toThrow();
    expect(wasTourDismissed("home-chat")).toBe(false);
  });
});
