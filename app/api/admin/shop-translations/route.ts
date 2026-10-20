import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { verifyBearerSecret } from "@/lib/security/cronAuth";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from "@/lib/i18n/config";
import { syncShopTranslations } from "@/lib/i18n/shopTranslation.server";
import { fetchPublicShops } from "@/app/(public)/map/services/shopCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** 1回の実行で訳す店の上限。AIの費用と実行時間を抑える。残りは次の実行で訳される */
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

/** 翻訳先のロケール（日本語は原文なので除く） */
const TARGET_LOCALES = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

async function run(locale: Locale, limit: number) {
  // 訳す対象は、一般に見える店（anon で読める店）だけ
  const shops = await fetchPublicShops();
  return syncShopTranslations({ shops, locale, limit });
}

function parseLimit(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

// 定期実行用（Vercel Cron は GET を送る）。CRON_SECRET が合うときだけ動く
export async function GET(req: NextRequest) {
  if (!verifyBearerSecret(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const results = [];
    for (const locale of TARGET_LOCALES) results.push(await run(locale, DEFAULT_LIMIT));
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error("[shop-translations]", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

// 手動実行用（管理者）。body: { locale?: "en", limit?: number }
export async function POST(req: NextRequest) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  // AIの費用がかかる処理なので、連打されても回数を絞る
  const rateLimited = await enforceRateLimit(req, {
    bucket: "admin-shop-translations",
    limit: 6,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const body = (await req.json().catch(() => ({}))) as { locale?: unknown; limit?: unknown };
  const locale = body.locale === undefined ? TARGET_LOCALES[0] : body.locale;
  if (!isLocale(locale) || locale === DEFAULT_LOCALE) {
    return NextResponse.json({ error: "locale が正しくありません" }, { status: 400 });
  }

  try {
    const result = await run(locale, parseLimit(body.limit));
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[shop-translations]", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
