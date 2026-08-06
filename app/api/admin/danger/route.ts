import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getRole } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DangerAction = "clean-map-history" | "delete-analytics";

export async function POST(request: Request) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "admin-danger",
      limit: 8,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || getRole(user) !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
    }

    const body = (await request.json()) as {
      action: DangerAction;
      password: string;
      keepCount?: number;
    };
    const { action, password } = body;

    if (!action || !password) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // パスワード検証（現在のユーザーのメールで再認証）
    const email = user.email;
    if (!email) {
      return NextResponse.json({ error: "User email not found" }, { status: 400 });
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 403 });
    }

    const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (action === "clean-map-history") {
      const keepCount = typeof body.keepCount === "number" && body.keepCount > 0 ? body.keepCount : 10;

      // 新しい順に keepCount 件を除いた古いレコードを削除
      const { data: keepRows, error: fetchError } = await serviceClient
        .from("map_layout_snapshots")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(keepCount);

      if (fetchError) {
        return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
      }

      const keepIds = (keepRows ?? []).map((r: { id: string }) => r.id);

      let deletedCount = 0;
      if (keepIds.length > 0) {
        const { count, error: deleteError } = await serviceClient
          .from("map_layout_snapshots")
          .delete({ count: "exact" })
          .not("id", "in", `(${keepIds.join(",")})`);

        if (deleteError) {
          return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
        }
        deletedCount = count ?? 0;
      } else {
        const { count, error: deleteError } = await serviceClient
          .from("map_layout_snapshots")
          .delete({ count: "exact" })
          .neq("id", "00000000-0000-0000-0000-000000000000");

        if (deleteError) {
          return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
        }
        deletedCount = count ?? 0;
      }

      await serviceClient.from("admin_audit_logs").insert({
        actor_id: user.id,
        action: "clean_map_history",
        target_type: "system",
        target_id: "map_layout_snapshots",
        details: `古いマップ履歴を整理: ${deletedCount}件削除、${keepIds.length}件保持`,
      });

      return NextResponse.json({ ok: true, deletedCount });
    }

    if (action === "delete-analytics") {
      const { count, error: deleteError } = await serviceClient
        .from("web_page_analytics")
        .delete({ count: "exact" })
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (deleteError) {
        return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
      }

      const deletedCount = count ?? 0;

      await serviceClient.from("admin_audit_logs").insert({
        actor_id: user.id,
        action: "delete_analytics",
        target_type: "system",
        target_id: "web_page_analytics",
        details: `分析ログを全削除: ${deletedCount}件`,
      });

      return NextResponse.json({ ok: true, deletedCount });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
