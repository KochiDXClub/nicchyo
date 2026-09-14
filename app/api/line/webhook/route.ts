import { NextResponse } from "next/server";
import { validateLineSignature } from "@/lib/line/signature";
import { sendLineReply } from "@/lib/line/client";
import { checkLineUserRateLimit } from "@/lib/line/rateLimit";
import {
  generateLineConsultReply,
  DEFAULT_LINE_QUICK_REPLIES,
} from "@/lib/line/consultAi";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import type { LineWebhookPayload, LineOutgoingMessage } from "@/lib/line/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://nicchyo-git-develop-yutodesuys-projects.vercel.app";

/** 友だち追加（初回フォロー）時のウェルカムメッセージ */
const WELCOME_GREETING_TEXT = `友だち追加、まっことありがとうねぇ！🍊
日曜市のAI案内役「にちよさん」です。

300年続く土佐の日曜市（追手筋1km・約300店）へようこそ！
あなたの散策をポケットからお手伝いするきね。

👇 こんなふうに使ってみてね 👇

🗺️ 【日曜市マップ】
いま自分がどこにいるか、お目当ての店がパッと探せるよ。

💬 【にちよさんに相談】
「おすすめの朝ごはんは？」「旬の果物ある？」って、このトークに気軽に話しかけてみてね！うちが土佐弁で案内するよ。

🚻 【おでかけサポート】
散策中にお困りの「近くのお手洗い」「ひと休みできるベンチ」「駅や電停への道案内」もすぐに調べられるき安心しとうせ。

画面下のメニューから、いつでもワンタップで開けます。
今日はええ風が吹きゆうねぇ、どうぞゆっくり歩いていってね！🍵`.trim();

export async function POST(request: Request) {
  try {
    // 1. エンドポイント全体のIPレートリミット（DDoS / 不正リクエスト防御）
    const rateLimited = await enforceRateLimit(request, {
      bucket: "line-webhook",
      limit: 120, // 1分あたり120リクエストまで許容
      windowMs: 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    // 2. 環境変数の確認
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!channelSecret || !channelAccessToken) {
      console.error(
        "[LINE webhook] Missing LINE_CHANNEL_SECRET or LINE_CHANNEL_ACCESS_TOKEN"
      );
      return NextResponse.json(
        { error: "LINE credentials not configured on server" },
        { status: 500 }
      );
    }

    // 3. リクエスト本文の取得と署名検証
    const rawBody = await request.text();
    const signature = request.headers.get("x-line-signature");

    if (!validateLineSignature(rawBody, channelSecret, signature)) {
      console.warn("[LINE webhook] Invalid x-line-signature rejected");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // 4. イベントペイロードの解析
    let payload: LineWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as LineWebhookPayload;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const events = payload.events ?? [];
    if (events.length === 0) {
      // LINE Developers の Webhook 検証用テストリクエストなど
      return NextResponse.json({ status: "ok", count: 0 }, { status: 200 });
    }

    // 5. 各イベントの処理（非同期並列処理）
    await Promise.all(
      events.map(async (event) => {
        try {
          // A. 友だち追加イベント
          if (event.type === "follow") {
            const welcomeMsg: LineOutgoingMessage = {
              type: "text",
              text: WELCOME_GREETING_TEXT,
              quickReply: { items: DEFAULT_LINE_QUICK_REPLIES },
            };
            await sendLineReply(channelAccessToken, event.replyToken, [
              welcomeMsg,
            ]);
            return;
          }

          // B. メッセージ受信イベント
          if (event.type === "message") {
            const userId =
              event.source.type === "user"
                ? event.source.userId
                : event.source.userId ??
                  ("groupId" in event.source
                    ? event.source.groupId
                    : "roomId" in event.source
                    ? event.source.roomId
                    : undefined);

            // ユーザーごとのレートリミット判定（スパム・過剰トークン消費防止）
            const rateLimitCheck = checkLineUserRateLimit(userId);
            if (!rateLimitCheck.allowed) {
              const blockedMsg: LineOutgoingMessage = {
                type: "text",
                text:
                  rateLimitCheck.message ||
                  "少し時間をおいてから、また気軽に話しかけてねぇ🍵",
                quickReply: { items: DEFAULT_LINE_QUICK_REPLIES },
              };
              await sendLineReply(channelAccessToken, event.replyToken, [
                blockedMsg,
              ]);
              return;
            }

            // B-1. テキストメッセージ
            if (event.message.type === "text") {
              const reply = await generateLineConsultReply(event.message.text);
              await sendLineReply(channelAccessToken, event.replyToken, [reply]);
              return;
            }

            // B-2. スタンプ受信
            if (event.message.type === "sticker") {
              const stickerReply: LineOutgoingMessage = {
                type: "text",
                text: "スタンプありがとう！日曜市のことなら何でも聞いてねぇ🍊\n「おすすめの朝ごはんある？」とか気軽に送ってや！",
                quickReply: { items: DEFAULT_LINE_QUICK_REPLIES },
              };
              await sendLineReply(channelAccessToken, event.replyToken, [
                stickerReply,
              ]);
              return;
            }

            // B-3. 写真・画像受信
            if (event.message.type === "image") {
              const imgReply: LineOutgoingMessage = {
                type: "text",
                text: "写真ありがとう！いまのところ文章での相談を受け付けゆうき、何か気になることや探しているお店があったら文字で教えてねぇ🍊",
                quickReply: { items: DEFAULT_LINE_QUICK_REPLIES },
              };
              await sendLineReply(channelAccessToken, event.replyToken, [
                imgReply,
              ]);
              return;
            }

            // B-4. 位置情報受信
            if (event.message.type === "location") {
              const locReply: LineOutgoingMessage = {
                type: "text",
                text: `位置情報を教えてくれてありがとう！近くの屋台を探すなら、下のメニューの【日曜市マップ】を開いてみてね。\n\n🗺️ 日曜市マップを開く：\n${APP_BASE_URL}/map`,
                quickReply: { items: DEFAULT_LINE_QUICK_REPLIES },
              };
              await sendLineReply(channelAccessToken, event.replyToken, [
                locReply,
              ]);
              return;
            }

            // B-5. その他のメディア
            const fallbackReply: LineOutgoingMessage = {
              type: "text",
              text: "メッセージありがとう！日曜市のことなら何でも聞いてねぇ🍊\n「おすすめの朝ごはんある？」って送ってみてね！",
              quickReply: { items: DEFAULT_LINE_QUICK_REPLIES },
            };
            await sendLineReply(channelAccessToken, event.replyToken, [
              fallbackReply,
            ]);
            return;
          }

          // C. ポストバック（リッチメニュー等のボタンタップ）
          if (event.type === "postback") {
            const data = event.postback.data;
            const reply = await generateLineConsultReply(data);
            await sendLineReply(channelAccessToken, event.replyToken, [reply]);
            return;
          }
        } catch (eventErr) {
          console.error("[LINE webhook] Error processing event:", eventErr);
        }
      })
    );

    // LINEプラットフォームには常に 200 OK を返して再送ループを防ぐ
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err) {
    console.error("[LINE webhook] Top-level handler error:", err);
    // 最上位例外でも 500 JSON を返す
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: "LINE Webhook endpoint is healthy. Use POST with LINE signature." },
    { status: 200 }
  );
}
