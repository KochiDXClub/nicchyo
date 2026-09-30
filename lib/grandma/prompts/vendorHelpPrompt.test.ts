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

  it("このお店の数字と日曜市全体の数字を入れ、取れなかった数字はそう伝える", () => {
    const prompt = buildVendorHelpSystemPrompt([], {}, {
      shop: {
        aiMentions: { total: 5, recommended: 3, topKeywords: ["いも天"] },
        hearts: null,
        topSales: [{ name: "トマト", quantity: 12 }],
      },
      market: { weeklyVisitors: 1234, monthlyVisitors: null, topSearchKeywords: [], topSellingProducts: ["なす"] },
    });

    expect(prompt).toContain("話題になった回数: 5回（そのうち、おすすめされた回数: 3回）");
    expect(prompt).toContain("よく出た言葉: いも天");
    expect(prompt).toContain("このお店の投稿へのハート: 取れなかった");
    expect(prompt).toContain("自分で記録した売れ数（多い順）: トマト 12");
    expect(prompt).toContain("nicchyo の来訪者数: 今週 1,234人 / 今月 取れなかった");
    expect(prompt).toContain("よく検索した言葉: まだない");
    expect(prompt).toContain("よく売れている商品: なす");
  });

  it("閲覧数とお気に入り数はまだ数えていないと伝えるよう指示する", () => {
    expect(buildVendorHelpSystemPrompt([], {})).toContain("お店の閲覧数とお気に入り数は、まだ数えていません");
  });
});
