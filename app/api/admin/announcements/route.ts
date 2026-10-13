import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { guardAdminWrite } from "@/lib/admin/shopApiGuard";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { parseAnnouncementInput, toAnnouncement, type AnnouncementRow } from "@/lib/announcements/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS = "id, title, body, important, published, starts_at, ends_at, created_at, updated_at" as const;

/** 運営向け: サイト内のお知らせの一覧（公開前・終了・非公開も含めて新しい順） */
export async function GET() {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.adminClient
    .from("site_announcements")
    .select(COLUMNS)
    .order("starts_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: "お知らせを取得できませんでした" }, { status: 500 });

  return NextResponse.json({ announcements: ((data ?? []) as AnnouncementRow[]).map(toAnnouncement) });
}

/** サイト内のお知らせを投稿する */
export async function POST(request: Request) {
  try {
    const guard = await guardAdminWrite(request, { bucket: "admin-announcement", limit: 60, json: true });
    if ("error" in guard) return guard.error;
    const { user, role, adminClient, ip } = guard.ctx;

    const parsed = parseAnnouncementInput(guard.body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { title, body, important, published, startsAt, endsAt } = parsed.value;

    const { data, error } = await adminClient
      .from("site_announcements")
      .insert({ title, body, important, published, starts_at: startsAt, ends_at: endsAt, created_by: user.id })
      .select(COLUMNS)
      .single();
    if (error || !data) return NextResponse.json({ error: "お知らせを投稿できませんでした" }, { status: 500 });

    await logAdminAudit(
      adminClient,
      { id: user.id, email: user.email, role },
      {
        action: "announcement_create",
        targetType: "announcement",
        targetId: data.id,
        targetName: title.slice(0, 500),
        details: `サイト内のお知らせを投稿（${published ? "公開" : "下書き"}${important ? "・重要" : ""}）`,
        ipAddress: ip,
      },
    );

    return NextResponse.json({ ok: true, announcement: toAnnouncement(data as AnnouncementRow) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "お知らせを投稿できませんでした" }, { status: 500 });
  }
}
