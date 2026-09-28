import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";

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

    // requireAdminApi() は role === "admin" のときだけ成功する
    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;
    const { user, role, adminClient: serviceClient } = auth;

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

    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 403 });
    }

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

      await logAdminAudit(
        serviceClient,
        { id: user.id, email: user.email, role },
        {
          action: "clean_map_history",
          targetType: "system",
          targetId: "map_layout_snapshots",
          details: `古いマップ履歴を整理: ${deletedCount}件削除、${keepIds.length}件保持`,
        }
      );

      return NextResponse.json({ ok: true, deletedCount });
    }

    if (action === "delete-analytics") {
      // web_page_analytics.id は数値（Postgres の identity 列）なので、
      // 他テーブルと同じ UUID の番兵値ではなく、実在しない数値（0）を使う。
      // 型なしクライアントのままでは気づけなかった不一致（Supabase の
      // delete は無条件削除を弾くため、全削除には常に真になる neq が要る）
      const { count, error: deleteError } = await serviceClient
        .from("web_page_analytics")
        .delete({ count: "exact" })
        .neq("id", 0);

      if (deleteError) {
        return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
      }

      const deletedCount = count ?? 0;

      await logAdminAudit(
        serviceClient,
        { id: user.id, email: user.email, role },
        {
          action: "delete_analytics",
          targetType: "system",
          targetId: "web_page_analytics",
          details: `分析ログを全削除: ${deletedCount}件`,
        }
      );

      return NextResponse.json({ ok: true, deletedCount });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
