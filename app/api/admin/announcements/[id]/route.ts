import { NextResponse } from "next/server";
import { guardAdminShopWrite } from "@/lib/admin/shopApiGuard";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { parseAnnouncementInput, toAnnouncement, type AnnouncementRow } from "@/lib/announcements/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS = "id, title, body, important, published, starts_at, ends_at, created_at, updated_at" as const;

// guardAdminShopWrite は、URL の ID（UUID）の確認・同一オリジン・管理者の認可・レート制限をまとめた入口。
// 名前は店舗用だが、[id] を持つ管理者の書き込みに共通で使える

/** サイト内のお知らせを更新する（公開の切り替え・取り下げも、全項目を送って更新する） */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await guardAdminShopWrite(request, params, { bucket: "admin-announcement", limit: 120, json: true });
    if ("error" in guard) return guard.error;
    const { user, role, adminClient, ip, id } = guard.ctx;

    const parsed = parseAnnouncementInput(guard.body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { title, body, important, published, startsAt, endsAt } = parsed.value;

    const { data, error } = await adminClient
      .from("site_announcements")
      .update({
        title,
        body,
        important,
        published,
        starts_at: startsAt,
        ends_at: endsAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "お知らせを更新できませんでした" }, { status: 500 });
    if (!data) return NextResponse.json({ error: "お知らせが見つかりません" }, { status: 404 });

    await logAdminAudit(
      adminClient,
      { id: user.id, email: user.email, role },
      {
        action: "announcement_update",
        targetType: "announcement",
        targetId: id,
        targetName: title.slice(0, 500),
        details: `サイト内のお知らせを更新（${published ? "公開" : "非公開"}${important ? "・重要" : ""}）`,
        ipAddress: ip,
      },
    );

    return NextResponse.json({ ok: true, announcement: toAnnouncement(data as AnnouncementRow) });
  } catch {
    return NextResponse.json({ error: "お知らせを更新できませんでした" }, { status: 500 });
  }
}

/** サイト内のお知らせを削除する */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await guardAdminShopWrite(request, params, { bucket: "admin-announcement", limit: 120 });
    if ("error" in guard) return guard.error;
    const { user, role, adminClient, ip, id } = guard.ctx;

    const { data, error } = await adminClient
      .from("site_announcements")
      .delete()
      .eq("id", id)
      .select("id, title")
      .maybeSingle();
    if (error) return NextResponse.json({ error: "お知らせを削除できませんでした" }, { status: 500 });
    if (!data) return NextResponse.json({ error: "お知らせが見つかりません" }, { status: 404 });

    await logAdminAudit(
      adminClient,
      { id: user.id, email: user.email, role },
      {
        action: "announcement_delete",
        targetType: "announcement",
        targetId: id,
        targetName: (data.title ?? id).slice(0, 500),
        details: "サイト内のお知らせを削除",
        ipAddress: ip,
      },
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "お知らせを削除できませんでした" }, { status: 500 });
  }
}
