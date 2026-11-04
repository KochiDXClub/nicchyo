/**
 * サイト内のお知らせ（site_announcements）の API の本体。
 * 運営（/api/admin/announcements）と高知市（/api/city/announcements）が同じ検証・同じ操作ログで動くよう、
 * ここに置く。違いは認可と、見える範囲だけ（scope）。
 *
 * 高知市は自分が投稿したものだけを見て・直して・消せる（運営の投稿は触れない）。
 * 運営（admin）は、どちらの入口からでも全件を扱える。
 */
import { NextResponse } from "next/server";
import { guardAdminShopWrite, guardAdminWrite, type AuthorizeFn } from "@/lib/admin/shopApiGuard";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { requireCityApi } from "@/lib/auth/requireCityApi";
import { parseAnnouncementInput, toAnnouncement, type AnnouncementRow } from "@/lib/announcements/schema";

export type AnnouncementScope = "admin" | "city";

const COLUMNS = "id, title, body, important, published, starts_at, ends_at, created_at, updated_at" as const;

const SCOPES: Record<AnnouncementScope, { authorize: AuthorizeFn; bucket: string }> = {
  admin: { authorize: requireAdminApi, bucket: "admin-announcement" },
  city: { authorize: requireCityApi, bucket: "city-announcement" },
};

/** 高知市の入口で入った担当者（admin 以外）は、自分の投稿だけを扱う */
function ownOnly(scope: AnnouncementScope, role: string | null): boolean {
  return scope === "city" && role !== "admin";
}

export async function listAnnouncements(scope: AnnouncementScope) {
  const auth = await SCOPES[scope].authorize();
  if ("error" in auth) return auth.error;

  let query = auth.adminClient.from("site_announcements").select(COLUMNS);
  if (ownOnly(scope, auth.role)) query = query.eq("created_by", auth.user.id);
  const { data, error } = await query.order("starts_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: "お知らせを取得できませんでした" }, { status: 500 });

  return NextResponse.json({ announcements: ((data ?? []) as AnnouncementRow[]).map(toAnnouncement) });
}

export async function createAnnouncement(request: Request, scope: AnnouncementScope) {
  try {
    const guard = await guardAdminWrite(request, { ...SCOPES[scope], limit: 60, json: true });
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

export async function updateAnnouncement(
  request: Request,
  params: Promise<{ id: string }>,
  scope: AnnouncementScope,
) {
  try {
    const guard = await guardAdminShopWrite(request, params, { ...SCOPES[scope], limit: 120, json: true });
    if ("error" in guard) return guard.error;
    const { user, role, adminClient, ip, id } = guard.ctx;

    const parsed = parseAnnouncementInput(guard.body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { title, body, important, published, startsAt, endsAt } = parsed.value;

    let query = adminClient
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
      .eq("id", id);
    if (ownOnly(scope, role)) query = query.eq("created_by", user.id);
    const { data, error } = await query.select(COLUMNS).maybeSingle();
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

export async function deleteAnnouncement(
  request: Request,
  params: Promise<{ id: string }>,
  scope: AnnouncementScope,
) {
  try {
    const guard = await guardAdminShopWrite(request, params, { ...SCOPES[scope], limit: 120 });
    if ("error" in guard) return guard.error;
    const { user, role, adminClient, ip, id } = guard.ctx;

    let query = adminClient.from("site_announcements").delete().eq("id", id);
    if (ownOnly(scope, role)) query = query.eq("created_by", user.id);
    const { data, error } = await query.select("id, title").maybeSingle();
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
