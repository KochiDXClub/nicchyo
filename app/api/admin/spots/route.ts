import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/permissions";
import { createAdminClient, authorizeAdmin } from "../categories/_helpers";
import { SPOT_CATEGORIES, type SpotCategory, type AdminSpot } from "@/lib/spots/adminSpot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * スポット（map_landmarks）の管理 API。
 * 電停・駅・建物・お手洗い・休けい場所を1テーブルで扱う。
 * 座標・サイズなど「マップに描く」項目はマップ編集画面が持ち、ここでは
 * スポットカードとおでかけサポートで使う属性（カテゴリ・写真・タグ・路線など）を編集する。
 */

export { SPOT_CATEGORIES, type SpotCategory, type AdminSpot } from "@/lib/spots/adminSpot";

const SELECT_COLUMNS =
  "key, name, description, image_url, latitude, longitude, width_px, height_px, show_at_min_zoom, category, transit_mode, lines, tags, notes, external_url, photo_url, photo_credit, open_from, open_until, show_on_map, verified, updated_at";

type SpotInput = Partial<Omit<AdminSpot, "updated_at">>;

const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function toStringArray(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const items = value.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
  return items.length > 30 ? null : items;
}

function nullableText(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.length > max) return undefined;
  return value.trim();
}

/** 入力を検証し、DB に書く形へ整える。エラーがあればメッセージを返す */
function validate(body: SpotInput, { requireAll }: { requireAll: boolean }):
  | { ok: true; values: Record<string, unknown> }
  | { ok: false; error: string } {
  const values: Record<string, unknown> = {};

  if (body.name !== undefined || requireAll) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80) return { ok: false, error: "名前は1〜80文字で入力してください" };
    values.name = name;
  }
  if (body.description !== undefined || requireAll) {
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (description.length > 400) return { ok: false, error: "説明は400文字以内で入力してください" };
    values.description = description;
  }
  if (body.category !== undefined || requireAll) {
    if (!SPOT_CATEGORIES.includes(body.category as SpotCategory)) {
      return { ok: false, error: "種別が不正です" };
    }
    values.category = body.category;
  }
  if (body.transit_mode !== undefined) {
    if (body.transit_mode !== null && body.transit_mode !== "tram" && body.transit_mode !== "jr") {
      return { ok: false, error: "交通機関の種別が不正です" };
    }
    values.transit_mode = body.transit_mode;
  }
  if (body.latitude !== undefined || requireAll) {
    const lat = Number(body.latitude);
    if (!Number.isFinite(lat) || lat < 33.4 || lat > 33.7) return { ok: false, error: "緯度が高知市の範囲外です" };
    values.latitude = lat;
  }
  if (body.longitude !== undefined || requireAll) {
    const lng = Number(body.longitude);
    if (!Number.isFinite(lng) || lng < 133.4 || lng > 133.7) return { ok: false, error: "経度が高知市の範囲外です" };
    values.longitude = lng;
  }
  if (body.image_url !== undefined || requireAll) {
    const imageUrl = typeof body.image_url === "string" ? body.image_url.trim() : "";
    if (!imageUrl || imageUrl.length > 500 || !(imageUrl.startsWith("/") || isHttpUrl(imageUrl))) {
      return { ok: false, error: "アイコン画像のURLが不正です" };
    }
    values.image_url = imageUrl;
  }
  for (const field of ["width_px", "height_px"] as const) {
    if (body[field] !== undefined || requireAll) {
      const n = Number(body[field] ?? 40);
      if (!Number.isFinite(n) || n <= 0 || n > 600) return { ok: false, error: "アイコンのサイズが不正です" };
      values[field] = n;
    }
  }
  if (body.show_at_min_zoom !== undefined) values.show_at_min_zoom = Boolean(body.show_at_min_zoom);
  if (body.show_on_map !== undefined) values.show_on_map = Boolean(body.show_on_map);
  if (body.verified !== undefined) values.verified = Boolean(body.verified);

  if (body.lines !== undefined) {
    const lines = toStringArray(body.lines);
    if (!lines) return { ok: false, error: "路線の形式が不正です" };
    values.lines = lines;
  }
  if (body.tags !== undefined) {
    const tags = toStringArray(body.tags);
    if (!tags) return { ok: false, error: "タグの形式が不正です" };
    values.tags = tags;
  }
  const notes = nullableText(body.notes, 600);
  if (body.notes !== undefined && notes === undefined) return { ok: false, error: "補足は600文字以内で入力してください" };
  if (notes !== undefined) values.notes = notes;

  const photoCredit = nullableText(body.photo_credit, 200);
  if (body.photo_credit !== undefined && photoCredit === undefined) {
    return { ok: false, error: "写真の出典は200文字以内で入力してください" };
  }
  if (photoCredit !== undefined) values.photo_credit = photoCredit;

  for (const field of ["open_from", "open_until"] as const) {
    const value = nullableText(body[field], 5);
    if (body[field] !== undefined && value === undefined) return { ok: false, error: "時刻は HH:MM で入力してください" };
    if (value !== undefined) {
      if (value !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
        return { ok: false, error: "時刻は HH:MM で入力してください" };
      }
      values[field] = value;
    }
  }

  for (const field of ["external_url", "photo_url"] as const) {
    const value = nullableText(body[field], 1000);
    if (body[field] !== undefined && value === undefined) return { ok: false, error: "URLが長すぎます" };
    if (value !== undefined) {
      if (value !== null && !isHttpUrl(value)) return { ok: false, error: "URLは http(s):// で始めてください" };
      values[field] = value;
    }
  }

  return { ok: true, values };
}

export async function GET() {
  const { error } = await authorizeAdmin();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data, error: dbError } = await dc
    .from("map_landmarks")
    .select(SELECT_COLUMNS)
    .order("category", { ascending: true })
    .order("created_at", { ascending: true });

  if (dbError) {
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ spots: data as unknown as AdminSpot[] });
}

export async function POST(req: Request) {
  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = (await req.json()) as SpotInput;
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!KEY_PATTERN.test(key)) {
    return NextResponse.json({ error: "キーは英小文字・数字・ハイフン（2〜64文字）で入力してください" }, { status: 400 });
  }

  const result = validate(body, { requireAll: true });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const { data: existing } = await dc.from("map_landmarks").select("key").eq("key", key).maybeSingle();
  if (existing) return NextResponse.json({ error: "同じキーのスポットがすでに存在します" }, { status: 409 });

  const { data, error: dbError } = await dc
    .from("map_landmarks")
    .insert({ key, ...result.values } as never)
    .select(SELECT_COLUMNS)
    .single();

  if (dbError) {
    return NextResponse.json({ error: "作成に失敗しました" }, { status: 500 });
  }

  await dc.from("admin_audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    actor_role: getRole(user),
    action: "spot_created",
    target_type: "map_landmark",
    target_id: key,
    details: JSON.stringify({ name: result.values.name, category: result.values.category }),
  });

  return NextResponse.json({ spot: data as unknown as AdminSpot }, { status: 201 });
}

export async function PATCH(req: Request) {
  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = (await req.json()) as SpotInput;
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!KEY_PATTERN.test(key)) return NextResponse.json({ error: "キーが不正です" }, { status: 400 });

  const result = validate(body, { requireAll: false });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  if (Object.keys(result.values).length === 0) {
    return NextResponse.json({ error: "変更する項目がありません" }, { status: 400 });
  }

  const { data, error: dbError } = await dc
    .from("map_landmarks")
    .update(result.values as never)
    .eq("key", key)
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (dbError) return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "スポットが見つかりません" }, { status: 404 });

  await dc.from("admin_audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    actor_role: getRole(user),
    action: "spot_updated",
    target_type: "map_landmark",
    target_id: key,
    details: JSON.stringify({ fields: Object.keys(result.values) }),
  });

  return NextResponse.json({ spot: data as unknown as AdminSpot });
}

export async function DELETE(req: Request) {
  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const key = (searchParams.get("key") ?? "").trim();
  if (!KEY_PATTERN.test(key)) return NextResponse.json({ error: "キーが不正です" }, { status: 400 });

  const { error: dbError, count } = await dc
    .from("map_landmarks")
    .delete({ count: "exact" })
    .eq("key", key);

  if (dbError) return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  if (!count) return NextResponse.json({ error: "スポットが見つかりません" }, { status: 404 });

  await dc.from("admin_audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    actor_role: getRole(user),
    action: "spot_deleted",
    target_type: "map_landmark",
    target_id: key,
    details: null,
  });

  return NextResponse.json({ ok: true });
}
