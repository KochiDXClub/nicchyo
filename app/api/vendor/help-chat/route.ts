import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClientWithExtensions } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireVendorRole } from "@/lib/auth/permissions";
import { requestChatCompletion } from "@/lib/ai/openaiFetch";
import { openAiSseToTextStream, TEXT_STREAM_HEADERS } from "@/lib/ai/textStream";
import { resolveAiModelFor } from "@/lib/ai/modelStore.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { VENDOR_HELP_GUIDE } from "@/lib/vendor/helpGuide";
import { loadVendorHelpMarketStats, loadVendorHelpShopStats, toDataWord } from "@/lib/vendor/helpChatStats.server";
import { PAYMENT_OPTIONS } from "@/lib/vendor/storeOptions";
import { HELP_PROPOSAL_TOOLS, proposalFromToolCalls, serializeProposal } from "@/lib/vendor/helpProposals";
import {
  buildVendorHelpSystemPrompt,
  type VendorHelpShopContext,
} from "@/lib/grandma/prompts/vendorHelpPrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 1つの質問の長さの上限。保存先（vendor_help_logs.question）の制約と揃える */
const VENDOR_HELP_QUESTION_MAX = 1000;
/** これまでのやりとりとして受け取る件数と、1件の長さの上限 */
const HISTORY_MAX = 10;
const HISTORY_TEXT_MAX = 2000;
const HISTORY_TOTAL_MAX = 6000;
/** 保存する答えの長さの上限（vendor_help_logs.answer の制約と揃える） */
const ANSWER_SAVE_MAX = 4000;

const HelpChatSchema = z.object({
  text: z.string().trim().min(1).max(VENDOR_HELP_QUESTION_MAX),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(HISTORY_TEXT_MAX),
      })
    )
    .max(HISTORY_MAX)
    .default([])
    // 1件ずつの上限だけでは、10件ぶん長文を送り続けられる。AI に渡す量の合計でも絞る
    .refine((items) => items.reduce((sum, item) => sum + item.text.length, 0) <= HISTORY_TOTAL_MAX),
});

type SupabaseLike = ReturnType<typeof createClientWithExtensions>;

/**
 * その出店者のお店の登録内容を読む。読むのは本人の cookie のクライアントなので、
 * 取れるのは自分の行だけ（vendors の RLS と列単位の GRANT のまま）。
 * 読めなくても相談自体はできるよう、失敗したら空で返す。
 */
async function loadShopContext(supabase: SupabaseLike, vendorId: string): Promise<VendorHelpShopContext> {
  const { data: vendor } = await supabase
    .from("vendors")
    .select(
      "shop_name, shop_image_url, category_id, style, main_products, schedule, business_hours_start, business_hours_end, payment_methods, sns_instagram, sns_x, sns_hp"
    )
    .eq("id", vendorId)
    .maybeSingle();
  if (!vendor) return {};

  // にちよさんがもう覚えていること。同じことを「覚えてよいか」と聞き直さないためだけに、トピックタイトルだけを渡す
  // （届け先の設定に関係なく。本文は渡さない）。読めなくても相談は続ける
  const { data: notes } = await supabase.from("store_knowledge").select("title").eq("store_id", vendorId).limit(50);

  const row = vendor as Record<string, unknown>;
  let category: string | null = null;
  if (typeof row.category_id === "string") {
    const { data } = await supabase.from("categories").select("name").eq("id", row.category_id).maybeSingle();
    category = (data as { name?: string } | null)?.name ?? null;
  }

  const start = row.business_hours_start as string | null;
  const end = row.business_hours_end as string | null;
  const paymentKeys = (row.payment_methods as string[] | null) ?? [];

  return {
    shopName: row.shop_name as string | null,
    category,
    style: row.style as string | null,
    mainProducts: (row.main_products as string[] | null) ?? [],
    schedule: (row.schedule as string[] | null) ?? [],
    businessHours: start && end ? `${start}〜${end}` : null,
    paymentMethods: paymentKeys.map((key) => PAYMENT_OPTIONS.find((option) => option.key === key)?.label ?? key),
    instagram: row.sns_instagram as string | null,
    x: row.sns_x as string | null,
    website: row.sns_hp as string | null,
    hasShopPhoto: typeof row.shop_image_url === "string" && row.shop_image_url.trim() !== "",
    rememberedTitles: ((notes ?? []) as { title: string | null }[])
      // 見出しのふりをした文字（【】や改行）で、プロンプトの枠を崩させない
      .map((note) => toDataWord(note.title ?? "", 60))
      .filter(Boolean),
  };
}

/**
 * 出店者トップのにちよさんへの相談（ヘルプデスク）。
 *
 * 来訪者の AI 相談とは別の口にして、出店者本人だけが使えるようにする。
 * にちよさんに渡すのは使い方ガイド、その出店者のお店の登録内容、このお店の数字と
 * 日曜市全体の数字（lib/vendor/helpChatStats.server.ts）。
 * 答えは文字のまま少しずつ流す（店舗ページのチャット /api/grandma/shop-chat と同じ形。lib/ai/textStream）。
 * 質問と答えは vendor_help_logs に残す（よくある質問からガイドを直すため）。
 *
 * 「営業時間を変えたい」のような頼みには、AI がお店の情報の変更案（lib/vendor/helpProposals.ts）を
 * 出すことがある。来訪者に伝えるとよいことを話したら「覚えてよいか」の案も出す。
 * 検証した案だけを答えの最後に区切り文字のあとに付けて返し、画面が確認してから保存する。
 */
export async function POST(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  // 認証前の連打を止める粗い上限。会場の Wi-Fi などで同じ IP の出店者が並ぶので広めにとる
  const floodLimited = await enforceRateLimit(request, {
    bucket: "vendor-help-chat-ip",
    limit: 300,
    windowMs: 10 * 60 * 1000,
  });
  if (floodLimited) return floodLimited;

  const cookieStore = await cookies();
  const supabase = createClientWithExtensions(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireVendorRole(user);
  if (forbidden) return forbidden;

  // AI を呼ぶので、出店者1人あたりの回数で絞る
  const rateLimited = await enforceRateLimit(request, {
    bucket: "vendor-help-chat",
    limit: 20,
    windowMs: 10 * 60 * 1000,
    identity: user.id,
  });
  if (rateLimited) return rateLimited;

  const parsed = HelpChatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "質問を読み取れませんでした" }, { status: 400 });
  }
  const { text, history } = parsed.data;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const [shop, shopStats, marketStats] = await Promise.all([
    loadShopContext(supabase, user.id),
    loadVendorHelpShopStats(supabase as unknown as SupabaseClient, user.id),
    loadVendorHelpMarketStats(supabase as unknown as SupabaseClient),
  ]);
  const systemPrompt = buildVendorHelpSystemPrompt(VENDOR_HELP_GUIDE, shop, {
    shop: shopStats,
    market: marketStats,
  });
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((message) => ({ role: message.role, content: message.text })),
    { role: "user", content: text },
  ];

  const aiModel = await resolveAiModelFor("vendorHelp");
  const upstream = await requestChatCompletion(apiKey, aiModel, {
    messages,
    maxOutputTokens: 400,
    temperature: 0.5,
    stream: true,
    // お店の情報の変更案。AI は案を出すだけで、保存は出店者が画面で確かめてから行う
    tools: HELP_PROPOSAL_TOOLS,
  }).catch(() => null);
  if (!upstream || !upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Upstream error" }, { status: 502 });
  }

  const vendorId = user.id;
  // 案の確かめに使う。出店者が自分で書いた文（いまの質問と、これまでの出店者の発言）と、
  // 来訪者やほかの出店者が入れた言葉（プロンプトの数字の欄）
  const vendorText = [...history.filter((turn) => turn.role === "user").map((turn) => turn.text), text].join("\n");
  const untrustedWords = [
    ...(shopStats?.aiMentions?.topKeywords ?? []),
    ...(marketStats?.topSearchKeywords ?? []),
    ...(marketStats?.topSellingProducts ?? []),
  ];
  let proposalNote = "";
  const readable = openAiSseToTextStream(upstream.body, {
    onToolCalls: (calls) => {
      const proposal = proposalFromToolCalls(calls, text, { vendorText, untrustedWords });
      if (!proposal) return null;
      // 覚える案は、出店者がやめたかもしれない本文を記録に残さず、トピックタイトルだけにする
      proposalNote =
        proposal.kind === "memory"
          ? `\n［覚える案］${proposal.note.title}`
          : proposal.kind === "edit"
            ? `\n［入力欄を開いた］${proposal.field}`
            : `\n［変更案］${JSON.stringify(proposal.answer)}`;
      return serializeProposal(proposal);
    },
    onFinish: (answer, { truncated }) => {
      // 後ろの印が切り捨てられないよう、長さは本文の方で詰める
      const suffix = `${proposalNote}${truncated ? "\n［途中で切れた］" : ""}`;
      return saveHelpLog(vendorId, text, answer.slice(0, ANSWER_SAVE_MAX - suffix.length) + suffix);
    },
  });

  return new Response(readable, { headers: TEXT_STREAM_HEADERS });
}

/** 記録に失敗しても、出店者への答えには影響させない */
async function saveHelpLog(vendorId: string, question: string, answer: string) {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const { error } = await admin.from("vendor_help_logs").insert({
      vendor_id: vendorId,
      question,
      answer: answer.slice(0, ANSWER_SAVE_MAX),
    });
    if (error) console.error("[vendor/help-chat] log insert error:", error.message);
  } catch (err) {
    console.error("[vendor/help-chat] log insert failed:", err instanceof Error ? err.message : err);
  }
}
