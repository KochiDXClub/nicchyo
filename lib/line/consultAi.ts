import { requestChatCompletion } from "../ai/openaiFetch";
import { resolveAiModelFor } from "../ai/modelStore.server";
import type { LineTextOutgoingMessage, LineQuickReplyItem } from "./types";

const APP_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://nicchyo-git-develop-yutodesuys-projects.vercel.app";

/** LINEメッセージ下部に添えるクイックリプライ選択肢 */
export const DEFAULT_LINE_QUICK_REPLIES: LineQuickReplyItem[] = [
  {
    type: "action",
    action: {
      type: "message",
      label: "おすすめの朝ごはん",
      text: "おすすめの朝ごはんある？",
    },
  },
  {
    type: "action",
    action: {
      type: "message",
      label: "いま旬のものは？",
      text: "今の季節のおすすめや旬のものは何？",
    },
  },
  {
    type: "action",
    action: {
      type: "message",
      label: "トイレ・ベンチ",
      text: "近くのトイレや休めるベンチはある？",
    },
  },
  {
    type: "action",
    action: {
      type: "uri",
      label: "日曜市マップ",
      uri: `${APP_BASE_URL}/map`,
    },
  },
];

/** 定番キーワードへの即時応答（APIコール不要で最速返信・コストゼロ） */
export function getKeywordQuickResponse(text: string): string | null {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, "");

  if (
    normalized === "マップ" ||
    normalized === "地図" ||
    normalized === "場所" ||
    normalized === "map"
  ) {
    return `日曜市マップはこちらから開けるきね！お目当てのお店や現在地がすぐに分かるよ。\n\n🗺️ 日曜市マップを開く：\n${APP_BASE_URL}/map`;
  }

  if (
    normalized === "トイレ" ||
    normalized === "お手洗い" ||
    normalized === "ベンチ" ||
    normalized === "休憩" ||
    normalized === "電停" ||
    normalized === "駅"
  ) {
    return `最寄りのトイレやベンチ、JR高知駅や路面電車の電停への道案内はおでかけサポートでチェックできるよ！\n\n🚻 おでかけサポートを開く：\n${APP_BASE_URL}/facilities`;
  }

  if (
    normalized === "近況" ||
    normalized === "ストーリー" ||
    normalized === "いま" ||
    normalized === "写真"
  ) {
    return `今日店頭に並んじゅう旬の果物やお店の写真スナップはここから見れるよ！\n\n📸 出店者の近況スナップを見る：\n${APP_BASE_URL}/story`;
  }

  if (
    normalized === "カレンダー" ||
    normalized === "開催" ||
    normalized === "雨" ||
    normalized === "中止" ||
    normalized === "時間"
  ) {
    return `日曜市の年間開催スケジュールや、雨天中止のアラートはこちらから確認できるきね！\n\n📅 日曜市カレンダーを見る：\n${APP_BASE_URL}/calendar`;
  }

  if (
    normalized === "協賛" ||
    normalized === "支援" ||
    normalized === "寄付" ||
    normalized === "応援"
  ) {
    return `日曜市を次代へつなぐ学生チームの活動へのご支援、まっことありがとう！\n\n❤️ 協賛・ご支援ページ：\n${APP_BASE_URL}/support`;
  }

  if (
    normalized === "こんにちは" ||
    normalized === "おはよう" ||
    normalized === "こんばんは" ||
    normalized === "はじめまして"
  ) {
    return `こんにちは！日曜市の案内役のにちよさんやきね🍊\n今日はええ風が吹きゆうねぇ。何か気になるお店や食べたいものがあったら、気軽に聞いてや！`;
  }

  return null;
}

/** LINE向けのAI相談プロンプト（スマホ画面で読みやすい長さ・温かい土佐弁） */
const LINE_GRANDMA_SYSTEM_PROMPT = `
あなたは高知・日曜市（追手筋1km・約300店）の公式AI案内役「にちよさん」です。
日曜市を訪れる観光客や地元の人に向けて、温かい土佐弁（〜ぜよ、〜やき、〜ちや、〜しとうせ等）で親身に案内してください。

【キャラクター設定】
- 高知・日曜市を何十年も見守ってきた、朗らかで優しいおばあちゃん。
- 観光客の質問を温かく受け止め、日曜市の空気感や人の温もりを伝えます。
- AIだけで完結させず、「お店の人にも声かけてみてね」「揚げたてが美味しいきね」など現地でのリアルな体験・会話を後押しします。

【LINEチャット向けの回答ルール】
1. 文字数は120字〜250字程度に収めてください。長すぎる文章は避け、スマホのLINE吹き出しで読みやすい長さにします。
2. 旬の味覚（いも天、田舎寿司、土佐文旦、新しょうが、ひやしあめ、刃物、木工品など）の日曜市ならではの魅力を伝えてください。
3. 危険な内容や無関係な質問には、「その相談には答えられんけんど、日曜市のお店や美味しいものなら一緒に考えられるよ」と優しく断ってください。
4. 末尾にお茶目な一言や励まし（🍵や🍊）を添えてください。
`.trim();

/**
 * ユーザーのLINEメッセージからAIにちよさんの返答を生成する。
 */
export async function generateLineConsultReply(
  userText: string
): Promise<LineTextOutgoingMessage> {
  const trimmed = userText.trim();

  // 1. 定番キーワード即時マッチ
  const quickAnswer = getKeywordQuickResponse(trimmed);
  if (quickAnswer) {
    return {
      type: "text",
      text: quickAnswer,
      quickReply: { items: DEFAULT_LINE_QUICK_REPLIES },
    };
  }

  // 2. 超短文・挨拶など
  if (trimmed.length < 2) {
    return {
      type: "text",
      text: "なんでも聞いてや！「おすすめの朝ごはんある？」とか「いも天はどこ？」って気軽に送ってねぇ🍵",
      quickReply: { items: DEFAULT_LINE_QUICK_REPLIES },
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[LINE consult] OPENAI_API_KEY is not configured");
    return {
      type: "text",
      text: `ごめんねぇ、いま相談の準備が整ってないみたいやき、下のメニューの【日曜市マップ】からお店を探してみてね！\n\n🗺️ 日曜市マップ：\n${APP_BASE_URL}/map`,
      quickReply: { items: DEFAULT_LINE_QUICK_REPLIES },
    };
  }

  try {
    const aiModel = await resolveAiModelFor("consult");

    // タイムアウト用コントローラー（LINEの返信制限時間考慮）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const response = await requestChatCompletion(apiKey, aiModel, {
      messages: [
        { role: "system", content: LINE_GRANDMA_SYSTEM_PROMPT },
        { role: "user", content: trimmed },
      ],
      maxOutputTokens: 350,
      temperature: 0.7,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        "[LINE consult] OpenAI API error:",
        response.status,
        await response.text().catch(() => "")
      );
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const replyContent =
      payload.choices?.[0]?.message?.content?.trim() ||
      "うまく言葉がまとまらんかったき、もう一回聞いてみてねぇ🍵";

    return {
      type: "text",
      text: replyContent,
      quickReply: { items: DEFAULT_LINE_QUICK_REPLIES },
    };
  } catch (err: unknown) {
    console.error("[LINE consult] Failed to generate AI reply:", err);
    return {
      type: "text",
      text: "いま少し頭がぼーっとしゆうみたい。少し時間をおいて、もう一回聞いてみてねぇ🍵\n\nお店の場所は下のメニューの【マップ】からも探せるきね！",
      quickReply: { items: DEFAULT_LINE_QUICK_REPLIES },
    };
  }
}
