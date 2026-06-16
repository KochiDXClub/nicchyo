import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getRole, isAdmin } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BulkAction = "suspend" | "restore" | "delete";

export async function POST(request: Request) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "admin-users-bulk",
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAdmin(getRole(user))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
    }

    const MAX_BULK = 200;
    const body = (await request.json()) as { action: BulkAction; ids: string[] };
    const { action, ids } = body;

    if (!action || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (ids.length > MAX_BULK) {
      return NextResponse.json({ error: `一度に操作できるのは${MAX_BULK}件までです` }, { status: 400 });
    }
    // 自分自身への操作を除外
    const safeIds = ids.filter((id) => id !== user.id);
    if (safeIds.length === 0) {
      return NextResponse.json({ error: "自分自身への操作はできません" }, { status: 400 });
    }

    const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const errors: string[] = [];

    if (action === "delete") {
      for (const id of safeIds) {
        const { error } = await serviceClient.auth.admin.deleteUser(id);
        if (error) errors.push(id);
      }
    } else if (action === "suspend") {
      for (const id of safeIds) {
        const { error } = await serviceClient.auth.admin.updateUserById(id, {
          ban_duration: "876000h",
        });
        if (error) errors.push(id);
      }
    } else if (action === "restore") {
      for (const id of safeIds) {
        const { error } = await serviceClient.auth.admin.updateUserById(id, {
          ban_duration: "none",
        });
        if (error) errors.push(id);
      }
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const actionLabel = action === "delete" ? "削除" : action === "suspend" ? "停止" : "復活";
    await serviceClient.from("admin_audit_logs").insert({
      actor_id: user.id,
      action: `bulk_${action}_user`,
      target_type: "user",
      target_id: safeIds.join(","),
      details: `${safeIds.length}件を一括${actionLabel}`,
    });

    if (errors.length > 0) {
      return NextResponse.json(
        { ok: false, error: `${errors.length}件の処理に失敗しました`, failedIds: errors },
        { status: 207 }
      );
    }

    return NextResponse.json({ ok: true, count: safeIds.length });
  } catch {
    return NextResponse.json({ error: "Failed to process bulk action" }, { status: 500 });
  }
}
