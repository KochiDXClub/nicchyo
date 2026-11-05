import { NextResponse } from "next/server";
import { guardAdminWrite } from "@/lib/admin/shopApiGuard";
import { requestChatCompletion } from "@/lib/ai/openaiFetch";
import { resolveAiModelFor } from "@/lib/ai/modelStore.server";
import { parseFirstJsonObject } from "@/lib/ai/structuredOutput";
import {
  CATEGORY_NAME_MAX,
  CATEGORY_TRANSLATION_RESPONSE_FORMAT,
  CATEGORY_TRANSLATION_SYSTEM_PROMPT,
  buildCategoryTranslationUserPrompt,
  parseCategoryTranslation,
} from "@/lib/categories/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 運営向け: カテゴリーの日本語名を英語名に訳して返す。保存はしない（画面が見せ、運営が直してから保存する）。
 * AI の呼び出しはサーバーだけ。キーはブラウザに出さない。
 */
export async function POST(request: Request) {
  try {
    const guard = await guardAdminWrite(request, { bucket: "admin-category-translate", limit: 60, json: true });
    if ("error" in guard) return guard.error;

    const raw = (guard.body as { name?: unknown } | null)?.name;
    const name = typeof raw === "string" ? raw.trim() : "";
    if (!name || name.length > CATEGORY_NAME_MAX) {
      return NextResponse.json({ error: "カテゴリ名を入れてから翻訳してください" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "翻訳の設定がされていません" }, { status: 503 });

    const aiModel = await resolveAiModelFor("translation");
    const response = await requestChatCompletion(apiKey, aiModel, {
      messages: [
        { role: "system", content: CATEGORY_TRANSLATION_SYSTEM_PROMPT },
        { role: "user", content: buildCategoryTranslationUserPrompt(name) },
      ],
      maxOutputTokens: 300,
      temperature: 0.2,
      responseFormat: CATEGORY_TRANSLATION_RESPONSE_FORMAT,
    });
    if (!response.ok) return NextResponse.json({ error: "翻訳できませんでした。少し待ってもう一度お試しください" }, { status: 502 });

    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const nameEn = parseCategoryTranslation(parseFirstJsonObject(payload.choices?.[0]?.message?.content ?? ""));
    if (!nameEn) return NextResponse.json({ error: "翻訳の結果を読み取れませんでした。もう一度お試しください" }, { status: 502 });

    return NextResponse.json({ ok: true, nameEn });
  } catch {
    return NextResponse.json({ error: "翻訳できませんでした" }, { status: 500 });
  }
}
