import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { AiSettingsSchema } from "@/lib/vendor/aiNotes";
import { requireVendor } from "../ai-notes/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT: にちよさんに渡すものの設定を保存する（読み出しは GET /api/vendor/ai-notes）
 */
export async function PUT(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const auth = await requireVendor();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const rateLimited = await enforceRateLimit(request, {
    bucket: "vendor-ai-notes-write",
    limit: 30,
    windowMs: 10 * 60 * 1000,
    identity: user.id,
  });
  if (rateLimited) return rateLimited;

  const parsed = AiSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "設定を読み取れませんでした" }, { status: 400 });

  const { error } = await supabase.from("vendor_ai_settings").upsert(
    {
      vendor_id: user.id,
      use_stats_in_vendor_help: parsed.data.useStatsInVendorHelp,
      share_popular_with_visitors: parsed.data.sharePopularWithVisitors,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "vendor_id" }
  );

  if (error) return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
  return NextResponse.json({ settings: parsed.data });
}
