import { FileWarning } from "lucide-react";
import { cookies } from "next/headers";
import { AdminLayout, AdminPageHeader } from "@/components/admin";
import { CodeHealthDashboard } from "@/components/admin/code-health/CodeHealthDashboard";
import { EmptyState } from "@/components/ui";
import { createClientWithExtensions } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

// 前回比を出すため、スナップショット切り替え用に直近何件かをまとめて取っておく
const SNAPSHOT_LIMIT = 10;

/**
 * コード健康診断（管理画面）
 *
 * 認可は app/(public)/admin/layout.tsx が行う（管理者以外はトップへ）。
 * データは code_health_snapshots から読むだけ。書き込みは CI（main への push）から
 * service role で行うので、ここでは admin の JWT で RLS を通す通常のクライアントで足りる。
 */
export default async function CodeHealthPage() {
  const supabase = createClientWithExtensions(await cookies());
  const { data: snapshots, error } = await supabase
    .from("code_health_snapshots")
    .select("id, commit, branch, summary, files, created_at")
    .order("created_at", { ascending: false })
    .limit(SNAPSHOT_LIMIT);

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="Code Health"
        title="コード健康診断"
        description="共通化率・コピペ率・デザインルール違反の状態を測る"
      />
      <div className="mx-auto max-w-7xl px-4 py-8 pb-20">
        {error ? (
          <EmptyState
            icon={FileWarning}
            tone="neutral"
            title="スナップショットを読み込めませんでした"
            description={`データベースへの問い合わせに失敗しました（${error.message}）。テーブルの作成・権限設定を確認してください。`}
          />
        ) : !snapshots || snapshots.length === 0 ? (
          <EmptyState
            icon={FileWarning}
            tone="neutral"
            title="まだスナップショットがありません"
            description="main へ push すると CI が npm run code-health:save を実行し、ここに結果が並びます。ローカルで試すには npm run code-health:save を直接実行してください。"
          />
        ) : (
          <CodeHealthDashboard snapshots={snapshots} />
        )}
      </div>
    </AdminLayout>
  );
}
