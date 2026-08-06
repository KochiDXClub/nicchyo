import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getRole, isAdmin } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody =
  | { action: "suspend" | "restore" }
  | { action: "change_role"; role: string };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "admin-users-id",
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAdmin(getRole(user))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (id === user.id) {
      return NextResponse.json({ error: "自分自身への操作はできません" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
    }

    const body = (await request.json()) as PatchBody;
    const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (body.action === "suspend") {
      const { error } = await serviceClient.auth.admin.updateUserById(id, {
        ban_duration: "876000h",
      });
      if (error) {
        console.error("[admin/users] suspend failed:", error.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }

      await serviceClient.from("admin_audit_logs").insert({
        actor_id: user.id,
        action: "suspend_user",
        target_type: "user",
        target_id: id,
        details: "ユーザーを停止",
      });
    } else if (body.action === "restore") {
      const { error } = await serviceClient.auth.admin.updateUserById(id, {
        ban_duration: "none",
      });
      if (error) {
        console.error("[admin/users] restore failed:", error.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }

      await serviceClient.from("admin_audit_logs").insert({
        actor_id: user.id,
        action: "restore_user",
        target_type: "user",
        target_id: id,
        details: "ユーザーを復帰",
      });
    } else if (body.action === "change_role") {
      const newRole = body.role;
      const validRoles = ["general_user", "vendor", "moderator", "admin"];
      if (!validRoles.includes(newRole)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }

      const { error } = await serviceClient.auth.admin.updateUserById(id, {
        app_metadata: { role: newRole },
      });
      if (error) {
        console.error("[admin/users] change_role failed:", error.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }

      await serviceClient.from("admin_audit_logs").insert({
        actor_id: user.id,
        action: "change_role",
        target_type: "user",
        target_id: id,
        details: `ロールを ${newRole} に変更`,
      });
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
