import { describe, expect, it } from "vitest";
import { VENDOR_HELP_GUIDE } from "@/lib/vendor/helpGuide";
import { buildVendorHelpSystemPrompt } from "./vendorHelpPrompt";

describe("buildVendorHelpSystemPrompt", () => {
  it("使い方ガイドの各項目と画面の場所を入れる", () => {
    const prompt = buildVendorHelpSystemPrompt(VENDOR_HELP_GUIDE, {});

    for (const section of VENDOR_HELP_GUIDE) {
      expect(prompt).toContain(`■ ${section.title}（画面: ${section.href}）`);
    }
  });

  it("お店の登録内容を入れ、空の項目は「まだ登録されていない」と伝える", () => {
    const prompt = buildVendorHelpSystemPrompt([], {
      shopName: "山田農園",
      mainProducts: ["トマト", " ", "なす"],
      paymentMethods: [],
      instagram: "  ",
      hasShopPhoto: true,
    });

    expect(prompt).toContain("・店名: 山田農園");
    expect(prompt).toContain("・主な商品: トマト、なす");
    expect(prompt).toContain("・支払い方法: まだ登録されていない");
    expect(prompt).toContain("・Instagram: まだ登録されていない");
    expect(prompt).toContain("・お店の写真: 登録済み");
  });

  it("答えられないことは運営への問い合わせへ案内するよう指示する", () => {
    const prompt = buildVendorHelpSystemPrompt([], {});

    expect(prompt).toContain("運営に問い合わせる");
    expect(prompt).toContain("推測で答えないでください");
  });
});
