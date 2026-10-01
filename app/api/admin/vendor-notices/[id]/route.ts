import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { requireSameOrigin } from "@/lib/security/requestGuards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE: お知らせを取り下げる（出店者の「確認しました」も一緒に消える）。
 * 書き直しは用意しない。確認済みの出店者がいる内容を黙って変えないよう、取り下げて出し直す。
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const { user, role, adminClient } = auth;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }

  const db = adminClient as unknown as SupabaseClient;
  const { data, error } = await db.from("vendor_notices").delete().eq("id", id).select("sender, title, body, important").maybeSingle();
  if (error) return NextResponse.json({ error: "取り下げられませんでした" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  const removed = data as { sender: string; title: string; body: string; important: boolean };

  await logAdminAudit(
    adminClient,
    { id: user.id, email: user.email, role },
    {
      action: "vendor_notice_deleted",
      targetType: "vendor_notice",
      targetId: id,
      targetName: removed.title,
      // 取り下げると行が消えるので、何を出していたかを残す
      details: JSON.stringify({ sender: removed.sender, important: removed.important, body: removed.body }),
    }
  );

  return NextResponse.json({ ok: true });
}
