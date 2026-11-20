import { NextResponse } from "next/server";
import { guardAdminWrite } from "@/lib/admin/shopApiGuard";
import { requestChatCompletion } from "@/lib/ai/openaiFetch";
import { resolveAiModelFor } from "@/lib/ai/modelStore.server";
import { parseFirstJsonObject } from "@/lib/ai/structuredOutput";
import { DEFAULT_SITE_COPY } from "@/lib/site-copy/content";
import {
  SITE_COPY_TRANSLATE_MAX_CHARS,
  SITE_COPY_TRANSLATE_MAX_ITEMS,
  SITE_COPY_TRANSLATION_RESPONSE_FORMAT,
  SITE_COPY_TRANSLATION_SYSTEM_PROMPT,
  buildSiteCopyTranslationUserPrompt,
  parseSiteCopyTranslation,
} from "@/lib/site-copy/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 関数の上限（maxDuration = 60 秒）より前に、AI の待ちを切る
const TRANSLATE_TIMEOUT_MS = 50_000;
const KNOWN_KEYS = new Set(Object.keys(DEFAULT_SITE_COPY.texts));

/**
 * 運営向け: サイト文言の日本語の原文を英語に訳して返す。保存はしない。
 * 画面が訳を入力欄に入れ、運営が確認・直してから「下書き保存」「公開」で保存する。
 * AI の呼び出しはサーバーだけで行う。費用がかかるので回数を絞る。
 */
export async function POST(request: Request) {
  try {
    const guard = await guardAdminWrite(request, { bucket: "admin-site-copy-translate", limit: 20, json: true });
    if ("error" in guard) return guard.error;

    const record = (guard.body ?? {}) as { items?: unknown };
    const raw = Array.isArray(record.items) ? record.items : [];
    const items: { key: string; text: string }[] = [];
    for (const item of raw) {
      const { key, text } = (item ?? {}) as { key?: unknown; text?: unknown };
      if (typeof key !== "string" || !KNOWN_KEYS.has(key) || typeof text !== "string" || !text.trim()) continue;
      items.push({ key, text: text.trim() });
    }
    const chars = items.reduce((sum, item) => sum + Array.from(item.text).length, 0);
    if (items.length < 1 || items.length > SITE_COPY_TRANSLATE_MAX_ITEMS || chars > SITE_COPY_TRANSLATE_MAX_CHARS) {
      return NextResponse.json({ error: "英訳する文言を選んでから押してください（一度に送れるのは60件までです）" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "翻訳の設定がされていません" }, { status: 503 });

    const aiModel = await resolveAiModelFor("translation");
    const response = await requestChatCompletion(apiKey, aiModel, {
      messages: [
        { role: "system", content: SITE_COPY_TRANSLATION_SYSTEM_PROMPT },
        { role: "user", content: buildSiteCopyTranslationUserPrompt(items) },
      ],
      maxOutputTokens: 8000,
      temperature: 0.2,
      responseFormat: SITE_COPY_TRANSLATION_RESPONSE_FORMAT,
    }, AbortSignal.timeout(TRANSLATE_TIMEOUT_MS));
    if (!response.ok) return NextResponse.json({ error: "翻訳できませんでした。少し待ってもう一度お試しください" }, { status: 502 });

    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const translations = parseSiteCopyTranslation(parseFirstJsonObject(payload.choices?.[0]?.message?.content ?? ""), items);
    if (Object.keys(translations).length === 0) return NextResponse.json({ error: "翻訳の結果を読み取れませんでした。もう一度お試しください" }, { status: 502 });

    return NextResponse.json({ ok: true, translations, model: aiModel.def.id });
  } catch {
    return NextResponse.json({ error: "翻訳できませんでした" }, { status: 500 });
  }
}
