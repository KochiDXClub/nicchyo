import { NextResponse } from "next/server";
import { guardAdminWrite } from "@/lib/admin/shopApiGuard";
import { requestChatCompletion } from "@/lib/ai/openaiFetch";
import { resolveAiModelFor } from "@/lib/ai/modelStore.server";
import { parseFirstJsonObject } from "@/lib/ai/structuredOutput";
import { ANNOUNCEMENT_BODY_MAX, ANNOUNCEMENT_TITLE_MAX } from "@/lib/announcements/schema";
import {
  ANNOUNCEMENT_TRANSLATION_RESPONSE_FORMAT,
  ANNOUNCEMENT_TRANSLATION_SYSTEM_PROMPT,
  buildAnnouncementTranslationUserPrompt,
  parseAnnouncementTranslation,
} from "@/lib/announcements/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 運営向け: お知らせ（日本語のタイトル・本文）を英語に訳して返す。保存はしない。
 * 画面が訳を見せ、運営が直してから、投稿・更新の API で日本語と一緒に保存する。
 * AI の呼び出しはサーバーだけで行い、キーはブラウザに出さない。費用がかかるので回数を絞る。
 */
export async function POST(request: Request) {
  try {
    const guard = await guardAdminWrite(request, { bucket: "admin-announcement-translate", limit: 30, json: true });
    if ("error" in guard) return guard.error;

    const record = (guard.body ?? {}) as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim() : "";
    const body = typeof record.body === "string" ? record.body.trim() : "";
    if (title.length < 1 || title.length > ANNOUNCEMENT_TITLE_MAX || body.length < 1 || body.length > ANNOUNCEMENT_BODY_MAX) {
      return NextResponse.json({ error: "タイトルと本文を入れてから翻訳してください" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "翻訳の設定がされていません" }, { status: 503 });

    const aiModel = await resolveAiModelFor("translation");
    const response = await requestChatCompletion(apiKey, aiModel, {
      messages: [
        { role: "system", content: ANNOUNCEMENT_TRANSLATION_SYSTEM_PROMPT },
        { role: "user", content: buildAnnouncementTranslationUserPrompt(title, body) },
      ],
      maxOutputTokens: 3000,
      temperature: 0.2,
      responseFormat: ANNOUNCEMENT_TRANSLATION_RESPONSE_FORMAT,
    });
    if (!response.ok) return NextResponse.json({ error: "翻訳できませんでした。少し待ってもう一度お試しください" }, { status: 502 });

    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const translation = parseAnnouncementTranslation(parseFirstJsonObject(payload.choices?.[0]?.message?.content ?? ""), {
      title,
      body,
    });
    if (!translation) return NextResponse.json({ error: "翻訳の結果を読み取れませんでした。もう一度お試しください" }, { status: 502 });

    return NextResponse.json({ ok: true, ...translation, model: aiModel.def.id });
  } catch {
    return NextResponse.json({ error: "翻訳できませんでした" }, { status: 500 });
  }
}
