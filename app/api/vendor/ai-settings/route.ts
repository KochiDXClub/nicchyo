import { NextResponse } from "next/server";
import { AiSettingsSchema } from "@/lib/vendor/aiNotes";
import { requireVendorWrite } from "../ai-notes/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT: にちよさんに渡すものの設定を保存する（読み出しは GET /api/vendor/ai-notes）
 */
export async function PUT(request: Request) {
  const auth = await requireVendorWrite(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

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
