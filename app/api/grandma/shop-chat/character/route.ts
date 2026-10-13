import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { publicCacheHeaders } from "@/lib/http/cacheHeaders";
import { fetchAiPrompts } from "@/lib/grandma/prompts/promptStore.server";
import { resolveShopCharacter, resolveShopCharacterId } from "@/lib/grandma/shopChat/character";
import { findPublicShop } from "@/lib/grandma/shopChat/context.server";

export const runtime = "nodejs";

/**
 * GET: このお店の相談で話すキャラ（名前・絵・あいさつの台本）。
 * 最初のひとことを送る前に、誰が答えるのかを出すために使う。人格の文面は返さない。
 */
export async function GET(req: NextRequest) {
  const rateLimited = await enforceRateLimit(req, {
    bucket: "grandma-shop-chat-character",
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const shopId = Number(req.nextUrl.searchParams.get("shopId"));
  if (!Number.isInteger(shopId) || shopId <= 0) {
    return NextResponse.json({ error: "shopId が正しくありません" }, { status: 400 });
  }

  const shop = await findPublicShop(shopId);
  if (!shop) return NextResponse.json({ error: "お店が見つかりません" }, { status: 404 });

  const prompts = await fetchAiPrompts();
  const { view } = resolveShopCharacter(resolveShopCharacterId(shop.vendorId), prompts);
  return NextResponse.json(
    { character: view },
    { headers: publicCacheHeaders({ maxAgeSeconds: 60, sMaxAgeSeconds: 300 }) }
  );
}
