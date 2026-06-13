import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { getRole, isAdmin } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BulkAction = "suspend" | "restore" | "delete";

export async function POST(request: Request) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = enforceRateLimit(request, {
      bucket: "admin-shops-bulk",
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
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const body = (await request.json()) as {
      action: BulkAction;
      ids: string[];
      confirmText?: string;
    };
    const { action, ids, confirmText } = body;

    if (!action || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (ids.length > 200) {
      return NextResponse.json({ error: "一度に操作できるのは200件までです" }, { status: 400 });
    }

    // 削除は取り消し不可のため、明示的な確認テキストを必須とする
    if (action === "delete" && confirmText !== "DELETE") {
      return NextResponse.json(
        { error: '削除を実行するには confirmText に "DELETE" を指定してください' },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 自分自身への操作を除外
    const withoutSelf = ids.filter((id) => id !== user.id);
    if (withoutSelf.length === 0) {
      return NextResponse.json({ error: "自分自身への操作はできません" }, { status: 400 });
    }

    // vendors テーブルに存在するIDのみに絞る（admin等を誤って操作しないため）
    const { data: validVendors, error: vendorFetchError } = await serviceClient
      .from("vendors")
      .select("id, shop_name")
      .in("id", withoutSelf);
    if (vendorFetchError) {
      return NextResponse.json({ error: "Failed to validate vendor IDs" }, { status: 500 });
    }

    const safeIds = validVendors?.map((v: { id: string }) => v.id) ?? [];
    if (safeIds.length === 0) {
      return NextResponse.json({ error: "対象の出店者が見つかりません" }, { status: 400 });
    }

    const shopNames = validVendors?.map((v: { id: string; shop_name: string | null }) => v.shop_name ?? v.id).join(", ") ?? "";
    const actionLabel = action === "delete" ? "削除" : action === "suspend" ? "停止" : "復活";
    const ip = getClientIp(request);

    // 監査ログを操作前に記録（削除後に失敗しても痕跡が残るよう）
    await serviceClient.from("admin_audit_logs").insert({
      actor_id: user.id,
      actor_email: user.email ?? null,
      actor_role: getRole(user),
      action: `bulk_${action}`,
      target_type: "vendor",
      target_id: safeIds.join(","),
      target_name: shopNames.slice(0, 500),
      details: `${safeIds.length}件を一括${actionLabel}`,
      ip_address: ip !== "unknown" ? ip : null,
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
