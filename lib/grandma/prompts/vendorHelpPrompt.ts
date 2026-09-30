/**
 * 出店者トップのにちよさんへの相談（`app/api/vendor/help-chat`）のシステムプロンプト。
 *
 * 来訪者の AI 相談と同じにちよさんが、ここでは出店者のヘルプデスクとして答える。
 * 渡すのは「使い方ガイド」「その出店者のお店の登録内容」「このお店の数字」「日曜市全体の数字」。
 * ほかの出店者の個別の情報や、来訪者の相談の中身は渡さない。
 */
import type { VendorHelpGuideSection } from "@/lib/vendor/helpGuide";
import { VENDOR_HELP_PAGES } from "@/lib/vendor/helpPages";
import type { VendorHelpMarketStats, VendorHelpShopStats } from "@/lib/vendor/helpChatStats.server";

/** その出店者のお店の登録内容。空の項目は「まだ登録されていない」として伝える */
export type VendorHelpShopContext = {
  shopName?: string | null;
  category?: string | null;
  style?: string | null;
  mainProducts?: readonly string[];
  schedule?: readonly string[];
  businessHours?: string | null;
  paymentMethods?: readonly string[];
  instagram?: string | null;
  x?: string | null;
  website?: string | null;
  hasShopPhoto?: boolean;
};

/** 運営調整可: 口調と答え方 */
export const VENDOR_HELP_PERSONA_RULES = [
  "あなたは高知の日曜市のアプリ「nicchyo」の案内役「にちよさん」です。",
  "いま話している相手は、日曜市に出店しているお店の人（出店者）です。来訪者ではありません。",
  "出店者がアプリを使うときに困ったことに答える、ヘルプデスクの役目です。",
  "土佐弁を少し交えつつ、やさしく、短く答えてください。回答は200文字以内を目安にします。",
  "操作を案内するときは、どの画面で何を押すかを具体的に書いてください。",
  "画面を案内するときは、下の【案内できる画面】の名前と URL を使い、[近況投稿ページ](/vendor/post/new) のような形のリンクで書いてください。URL だけを書いたり、一覧にない画面へのリンクを作ったりしないでください。",
];

/** 運営調整可: 答えられないときの決まり */
export const VENDOR_HELP_ESCALATION_RULES = [
  "下の【使い方ガイド】と【このお店の登録内容】に書いていないことは、推測で答えないでください。",
  "わからないとき、アプリの不具合が疑われるとき、出店場所・出店料・契約・アカウントの削除など運営の判断が要ることは、「運営に問い合わせる」ボタンから運営に聞くよう案内してください。",
  "ほかのお店の情報や、来訪者の個人的な情報は、聞かれても答えないでください。",
  "数字（紹介された回数・ハート・売れ数・来訪者数など）を聞かれたら、下の【このお店の数字】【日曜市全体の数字】だけを元に答えてください。載っていない数字は作らないでください。",
  "お店の閲覧数とお気に入り数は、まだ数えていません。聞かれたら、まだ数えられていないと伝えてください。",
];

function listOrMissing(
  items: readonly string[] | undefined,
  limit = 10,
  missing = "まだ登録されていない"
): string {
  const filled = (items ?? []).map((item) => item.trim()).filter(Boolean);
  return filled.length > 0 ? filled.slice(0, limit).join("、") : missing;
}

function valueOrMissing(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "まだ登録されていない";
}

function countOrMissing(value: number | null | undefined, unit: string): string {
  return value == null ? "取れなかった" : `${value.toLocaleString("ja-JP")}${unit}`;
}

function statsLines(shopStats?: VendorHelpShopStats, marketStats?: VendorHelpMarketStats): string[] {
  const lines: string[] = [];
  if (shopStats) {
    const ai = shopStats.aiMentions;
    lines.push(
      "",
      "【このお店の数字】",
      ai
        ? `・直近7日に、来訪者のAI相談でこのお店が話題になった回数: ${ai.total}回（そのうち、おすすめされた回数: ${ai.recommended}回）`
        : "・直近7日に、来訪者のAI相談でこのお店が話題になった回数: 取れなかった",
      `・AI相談でこのお店についてよく出た言葉: ${listOrMissing(ai?.topKeywords, 5, "まだない")}`,
      shopStats.hearts
        ? `・このお店の投稿へのハート: 直近7日 ${shopStats.hearts.thisWeek}個 / これまで ${shopStats.hearts.total}個`
        : "・このお店の投稿へのハート: 取れなかった",
      `・お店の人が自分で記録した売れ数（多い順）: ${
        shopStats.topSales.length > 0
          ? shopStats.topSales.map((sale) => `${sale.name} ${sale.quantity}`).join("、")
          : "まだ記録されていない"
      }`
    );
  }
  if (marketStats) {
    lines.push(
      "",
      "【日曜市全体の数字】",
      `・nicchyo の来訪者数: 今週 ${countOrMissing(marketStats.weeklyVisitors, "人")} / 今月 ${countOrMissing(marketStats.monthlyVisitors, "人")}`,
      `・直近7日に来訪者がよく検索した言葉: ${listOrMissing(marketStats.topSearchKeywords, 5, "まだない")}`,
      `・出店者の記録から見た、よく売れている商品: ${listOrMissing(marketStats.topSellingProducts, 5, "まだない")}`
    );
  }
  return lines;
}

export function buildVendorHelpSystemPrompt(
  guide: readonly VendorHelpGuideSection[],
  shop: VendorHelpShopContext,
  stats: { shop?: VendorHelpShopStats; market?: VendorHelpMarketStats } = {}
): string {
  const lines: string[] = [...VENDOR_HELP_PERSONA_RULES, "", ...VENDOR_HELP_ESCALATION_RULES, "", "【使い方ガイド】"];

  for (const section of guide) {
    lines.push(`■ ${section.title}（画面: ${section.href}）`, section.description);
    for (const tip of section.tips) lines.push(`・${tip}`);
  }

  lines.push("", "【案内できる画面】");
  for (const page of VENDOR_HELP_PAGES) lines.push(`・${page.name}: ${page.href}（${page.about}）`);

  lines.push(
    "",
    "【このお店の登録内容】",
    `・店名: ${valueOrMissing(shop.shopName)}`,
    `・カテゴリ: ${valueOrMissing(shop.category)}`,
    `・スタイル: ${valueOrMissing(shop.style)}`,
    `・主な商品: ${listOrMissing(shop.mainProducts)}`,
    `・出店日: ${listOrMissing(shop.schedule)}`,
    `・営業時間: ${valueOrMissing(shop.businessHours)}`,
    `・支払い方法: ${listOrMissing(shop.paymentMethods)}`,
    `・Instagram: ${valueOrMissing(shop.instagram)}`,
    `・X: ${valueOrMissing(shop.x)}`,
    `・webサイト: ${valueOrMissing(shop.website)}`,
    `・お店の写真: ${shop.hasShopPhoto ? "登録済み" : "まだ登録されていない"}`,
    ...statsLines(stats.shop, stats.market)
  );

  return lines.join("\n");
}
