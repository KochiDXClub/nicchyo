import { describe, expect, it } from "vitest";
import { VENDOR_FAQ } from "@/lib/vendor/helpFaq";
import { VENDOR_HELP_PAGES } from "@/lib/vendor/helpPages";
import { buildVendorHelpSystemPrompt } from "./vendorHelpPrompt";

describe("buildVendorHelpSystemPrompt", () => {
  it("よくある質問の各項目と画面の場所を入れる", () => {
    const prompt = buildVendorHelpSystemPrompt(VENDOR_FAQ, {});

    expect(prompt).toContain("【よくある質問】");
    for (const item of VENDOR_FAQ) {
      expect(prompt).toContain(`Q. ${item.q}`);
      expect(prompt).toContain(`A. ${item.a}${item.href ? `（画面: ${item.href}）` : ""}`);
    }
  });

  it("案内できる画面を名前と URL で渡し、名前をリンクにして書くよう伝える", () => {
    const prompt = buildVendorHelpSystemPrompt([], {});

    for (const page of VENDOR_HELP_PAGES) {
      expect(prompt).toContain(`・${page.name}: ${page.href}`);
    }
    expect(prompt).toContain("[近況投稿ページ](/vendor/posts)");
    expect(prompt).toContain("一覧にない画面へのリンクを作ったりしないでください");
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
        views: { thisWeek: 12, lastWeek: 8 },
        hearts: null,
      },
      market: { weeklyVisitors: 1234, monthlyVisitors: null, topSearchKeywords: [] },
    });

    expect(prompt).toContain("話題になった回数: 5回（そのうち、おすすめされた回数: 3回）");
    expect(prompt).toContain("よく出た言葉: いも天");
    expect(prompt).toContain("このお店が見られた回数（お店の詳細が開かれた回数）: 直近7日 12回 / その前の7日 8回");
    expect(prompt).toContain("このお店の投稿へのハート: 取れなかった");
    // 手で入れる売れ数は、更新されなくなったので渡さない
    expect(prompt).not.toContain("売れ数");
    expect(prompt).not.toContain("よく売れている商品");
    expect(prompt).toContain("nicchyo の来訪者数: 今週（月曜から今日まで） 1,234人 / 今月 取れなかった");
    expect(prompt).toContain("よく検索した言葉: まだない");
  });

  it("お店の数字を見る権限がないアカウントには、数字を渡さず、0回などと答えないよう伝える", () => {
    const prompt = buildVendorHelpSystemPrompt([], {}, {
      // 渡された数字があっても、権限がなければ使わない（取り違えて答えないため）
      shop: { aiMentions: null, views: { thisWeek: 0, lastWeek: 0 }, hearts: null },
      shopHidden: true,
      market: { weeklyVisitors: 1234, monthlyVisitors: 5000, topSearchKeywords: [] },
    });

    expect(prompt).toContain("お店の数字（見られた回数・ハート・AI相談で話題になった回数）を見る権限がありません");
    expect(prompt).toContain("0回などと答えてはいけない");
    expect(prompt).not.toContain("直近7日 0回");
    expect(prompt).not.toContain("このお店が見られた回数（お店の詳細が開かれた回数）:");
    // 日曜市全体の数字は、お店の権限に関係なく使える
    expect(prompt).toContain("nicchyo の来訪者数: 今週（月曜から今日まで） 1,234人");
  });

  it("お気に入り数は数えられない、閲覧数は【このお店の数字】だけで答えるよう指示する", () => {
    const prompt = buildVendorHelpSystemPrompt([], {});
    expect(prompt).toContain("お店のお気に入り数は、お客さんの端末の中にしか無く、数えられません");
    expect(prompt).not.toContain("まだ正しく数えられていません");
    expect(prompt).toContain("お店が見られた回数は、下の【このお店の数字】にあるものだけで答えてください");
  });

  it("分析の数字がまだ無いときの伝え方を指示する", () => {
    expect(buildVendorHelpSystemPrompt([], {})).toContain("記録がまだないあいだは0や「—」で出ます");
  });
});
