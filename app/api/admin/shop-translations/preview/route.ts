import { NextResponse } from "next/server";
import { guardAdminWrite } from "@/lib/admin/shopApiGuard";
import { parseTranslationSourceInput } from "@/lib/admin/shopTranslationInput";
import { previewShopTranslation } from "@/lib/i18n/shopTranslation.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 運営向け（現場登録）: まだ保存していない日本語の店名・ひとこと・出店スタイル・商品名を英語に訳して返す。
 * 保存はしない。画面が訳を見せ、運営が直してから、/api/admin/shops/[id]/translation で保存する。
 * AI の呼び出しはサーバーだけ。キーはブラウザに出さない。費用がかかるので回数を絞る。
 */
export async function POST(request: Request) {
  try {
    const guard = await guardAdminWrite(request, { bucket: "admin-shop-translation-preview", limit: 60, json: true });
    if ("error" in guard) return guard.error;

    const parsed = parseTranslationSourceInput(guard.body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "翻訳の設定がされていません" }, { status: 503 });

    const result = await previewShopTranslation(parsed.value, "en");
    if (!result) return NextResponse.json({ error: "翻訳の結果を読み取れませんでした。もう一度お試しください" }, { status: 502 });
    return NextResponse.json({ ok: true, ...result.translation, model: result.model });
  } catch (error) {
    console.error("[shop-translations/preview]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "翻訳できませんでした。少し待ってもう一度お試しください" }, { status: 502 });
  }
}
