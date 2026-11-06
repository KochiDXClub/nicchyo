import { NextResponse } from "next/server";
import { readPublicLegacyIdentities } from "@/lib/shops/publicIdentity.server";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { privateNoStoreHeaders } from "@/lib/http/cacheHeaders";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, { bucket: "public-legacy-shop-identities", limit: 1000, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;
  try {
    return NextResponse.json(await readPublicLegacyIdentities(), { headers: privateNoStoreHeaders() });
  } catch {
    return NextResponse.json({ error: "店舗の対応を確認できませんでした" }, { status: 503, headers: privateNoStoreHeaders() });
  }
}
