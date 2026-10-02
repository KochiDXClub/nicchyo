import { describe, expect, it } from "vitest";
import { noticesForBanner, type VendorNotice } from "./noticesService";

const NOW = Date.parse("2026-10-02T00:00:00Z");
const notice = (id: string, createdAt: string, confirmed = false): VendorNotice => ({
  id,
  sender: "operator",
  title: id,
  body: "b",
  important: false,
  createdAt,
  confirmed,
});

describe("noticesForBanner", () => {
  it("まだ確認していない直近のお知らせだけを出す", () => {
    const notices = [
      notice("new", "2026-09-30T00:00:00Z"),
      notice("done", "2026-09-30T00:00:00Z", true),
      notice("old", "2026-08-01T00:00:00Z"),
    ];
    expect(noticesForBanner({ notices, joinedAt: "2026-01-01T00:00:00Z" }, NOW).map((n) => n.id)).toEqual(["new"]);
  });

  it("アカウントを作る前に出たお知らせは帯に出さない", () => {
    const notices = [notice("before", "2026-09-20T00:00:00Z"), notice("after", "2026-09-28T00:00:00Z")];
    expect(noticesForBanner({ notices, joinedAt: "2026-09-25T00:00:00Z" }, NOW).map((n) => n.id)).toEqual(["after"]);
  });
});
