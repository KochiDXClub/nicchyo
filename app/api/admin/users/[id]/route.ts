import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";

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
    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;
    const { user, role, adminClient: serviceClient } = auth;
    if (id === user.id) {
      return NextResponse.json({ error: "自分自身への操作はできません" }, { status: 400 });
    }

    const body = (await request.json()) as PatchBody;

    if (body.action === "suspend") {
      const { error } = await serviceClient.auth.admin.updateUserById(id, {
        ban_duration: "876000h",
      });
      if (error) {
        console.error("[admin/users] suspend failed:", error.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }

      await logAdminAudit(
        serviceClient,
        { id: user.id, email: user.email, role },
        { action: "suspend_user", targetType: "user", targetId: id, details: "ユーザーを停止" }
      );
    } else if (body.action === "restore") {
      const { error } = await serviceClient.auth.admin.updateUserById(id, {
        ban_duration: "none",
      });
      if (error) {
        console.error("[admin/users] restore failed:", error.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }

      await logAdminAudit(
        serviceClient,
        { id: user.id, email: user.email, role },
        { action: "restore_user", targetType: "user", targetId: id, details: "ユーザーを復帰" }
      );
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

      await logAdminAudit(
        serviceClient,
        { id: user.id, email: user.email, role },
        { action: "change_role", targetType: "user", targetId: id, details: `ロールを ${newRole} に変更` }
      );
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
