import { VENDOR_FAQ } from "./helpFaq";
import { VENDOR_HELP_PAGES, findVendorHelpPage } from "./helpPages";

describe("VENDOR_HELP_PAGES", () => {
  it("よくある質問に出てくる画面は、すべて案内できる画面に入っている", () => {
    for (const item of VENDOR_FAQ) {
      if (item.href) expect(findVendorHelpPage(item.href)).not.toBeNull();
    }
  });

  it("名前と URL が重ならない", () => {
    expect(new Set(VENDOR_HELP_PAGES.map((page) => page.name)).size).toBe(VENDOR_HELP_PAGES.length);
    expect(new Set(VENDOR_HELP_PAGES.map((page) => page.href)).size).toBe(VENDOR_HELP_PAGES.length);
  });
});

describe("findVendorHelpPage", () => {
  it("一覧にある画面を返す（末尾の / は無視する）", () => {
    expect(findVendorHelpPage("/vendor/post/new")?.name).toBe("近況投稿ページ");
    expect(findVendorHelpPage("/my-shop/schedule/")?.name).toBe("出店カレンダーページ");
  });

  it("一覧に無い URL や外のサイトは返さない", () => {
    expect(findVendorHelpPage("/admin")).toBeNull();
    expect(findVendorHelpPage("https://evil.example/vendor/store")).toBeNull();
    expect(findVendorHelpPage("//evil.example")).toBeNull();
  });
});
