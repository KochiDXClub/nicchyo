import { NextResponse } from "next/server";
import { guardAdminWrite } from "@/lib/admin/shopApiGuard";
import { requestChatCompletion } from "@/lib/ai/openaiFetch";
import { resolveAiModelFor } from "@/lib/ai/modelStore.server";
import { parseFirstJsonObject } from "@/lib/ai/structuredOutput";
import {
  SPOT_DESCRIPTION_MAX,
  SPOT_NAME_MAX,
  SPOT_TRANSLATION_RESPONSE_FORMAT,
  SPOT_TRANSLATION_SYSTEM_PROMPT,
  buildSpotTranslationUserPrompt,
  parseSpotTranslation,
} from "@/lib/spots/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** AI を待つ上限。maxDuration（60 秒）より短くして、詰まったら「もう一度お試しください」を返す */
const SPOT_TRANSLATE_TIMEOUT_MS = 20_000;

/**
 * 運営向け: スポットの日本語の名前・説明を英語に訳して返す。保存はしない（画面が見せ、運営が直してから保存する）。
 * AI の呼び出しはサーバーだけ。キーはブラウザに出さない。
 */
export async function POST(request: Request) {
  try {
    const guard = await guardAdminWrite(request, { bucket: "admin-spot-translate", limit: 60, json: true });
    if ("error" in guard) return guard.error;

    const raw = (guard.body ?? {}) as { name?: unknown; description?: unknown };
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const description = typeof raw.description === "string" ? raw.description.trim() : "";
    if (!name || name.length > SPOT_NAME_MAX || description.length > SPOT_DESCRIPTION_MAX) {
      return NextResponse.json({ error: "名前を入れてから翻訳してください" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "翻訳の設定がされていません" }, { status: 503 });

    const aiModel = await resolveAiModelFor("translation");
    // 打ち切り・通信断は例外で来る。外側の catch（500）に落とさず、!ok と同じ 502 にする
    const response = await requestChatCompletion(apiKey, aiModel, {
      messages: [
        { role: "system", content: SPOT_TRANSLATION_SYSTEM_PROMPT },
        { role: "user", content: buildSpotTranslationUserPrompt({ name, description }) },
      ],
      maxOutputTokens: 500,
      temperature: 0.2,
      responseFormat: SPOT_TRANSLATION_RESPONSE_FORMAT,
    }, AbortSignal.timeout(SPOT_TRANSLATE_TIMEOUT_MS)).catch(() => null);
    if (!response?.ok) return NextResponse.json({ error: "翻訳できませんでした。少し待ってもう一度お試しください" }, { status: 502 });

    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const english = parseSpotTranslation(parseFirstJsonObject(payload.choices?.[0]?.message?.content ?? ""));
    if (!english) return NextResponse.json({ error: "翻訳の結果を読み取れませんでした。もう一度お試しください" }, { status: 502 });

    return NextResponse.json({ ok: true, nameEn: english.nameEn, descriptionEn: english.descriptionEn });
  } catch {
    return NextResponse.json({ error: "翻訳できませんでした" }, { status: 500 });
  }
}
