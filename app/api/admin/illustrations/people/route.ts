import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { isIllustrationId, parsePeopleIllustration } from "@/lib/map/illustrations/people";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireSameOrigin } from "@/lib/security/requestGuards";

const TABLE = "map_people_illustrations";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const [people, markets] = await Promise.all([
    auth.adminClient.from(TABLE).select("*").order("name").order("id"),
    auth.adminClient.from("markets").select("id,name,weekday,is_public").order("weekday").order("name"),
  ]);
  if (people.error || markets.error) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  return NextResponse.json({ people: people.data, markets: markets.data });
}

async function authorizeWrite(req: Request) {
  const origin = requireSameOrigin(req);
  if (!origin.ok) return { error: origin.response };
  const limited = await enforceRateLimit(req, { bucket: "admin-people-illustrations", limit: 60, windowMs: 600_000 });
  if (limited) return { error: limited };
  return requireAdminApi();
}

async function save(req: Request, editing: boolean) {
  const auth = await authorizeWrite(req);
  if ("error" in auth) return auth.error;

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "入力が無効です" }, { status: 400 });
  }
  const { id, ...input } = body as Record<string, unknown>;
  if (editing && !isIllustrationId(id)) return NextResponse.json({ error: "イラストの指定が無効です" }, { status: 400 });
  const values = parsePeopleIllustration(input);
  if (typeof values === "string") return NextResponse.json({ error: values }, { status: 400 });

  const { adminClient, user, role } = auth;
  const query = editing && isIllustrationId(id)
    ? adminClient.from(TABLE).update(values).eq("id", id)
    : adminClient.from(TABLE).insert(values);
  const { data, error } = await query.select("*").maybeSingle();
  if (error?.code === "23503") return NextResponse.json({ error: "指定した市が見つかりません" }, { status: 400 });
  if (error) return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "イラストが見つかりません" }, { status: 404 });

  revalidatePath("/map");
  await logAdminAudit(adminClient, { id: user.id, email: user.email, role }, {
    action: editing ? "map_people_illustration_updated" : "map_people_illustration_created",
    targetType: TABLE,
    targetId: data.id,
    targetName: data.name,
  });
  return NextResponse.json({ illustration: data }, { status: editing ? 200 : 201 });
}

export function POST(req: Request) {
  return save(req, false);
}

export function PATCH(req: Request) {
  return save(req, true);
}

export async function DELETE(req: Request) {
  const auth = await authorizeWrite(req);
  if ("error" in auth) return auth.error;

  const id = new URL(req.url).searchParams.get("id");
  if (!isIllustrationId(id)) return NextResponse.json({ error: "イラストの指定が無効です" }, { status: 400 });

  const { adminClient, user, role } = auth;
  const { data, error } = await adminClient.from(TABLE).delete().eq("id", id).select("name").maybeSingle();
  if (error) return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "イラストが見つかりません" }, { status: 404 });

  revalidatePath("/map");
  await logAdminAudit(adminClient, { id: user.id, email: user.email, role }, {
    action: "map_people_illustration_deleted", targetType: TABLE, targetId: id, targetName: data.name,
  });
  return NextResponse.json({ ok: true });
}
