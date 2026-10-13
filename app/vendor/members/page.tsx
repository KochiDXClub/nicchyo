"use client";

export const dynamic = "force-dynamic";

import { Button, CenteredLoading, PageContainer, PageShell, PageTitle } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/utils/cn";
import { hasShopPermission } from "@/lib/vendor/shopPermissions";
import ActivityLogSection from "./components/ActivityLogSection";
import InvitesSection from "./components/InvitesSection";
import MembersSection from "./components/MembersSection";
import { useMembers } from "./useMembers";

/**
 * メンバー管理。お店のメンバー → 家族やスタッフを招待する → 操作ログ、の順。
 * メンバー一覧はメンバーなら誰でも見られる。招待（と権限の変更）はメンバーの管理ができる人、操作ログはその権限がある人にだけ出す。
 * 権限の規則は lib/vendor/memberRules.ts で、API も同じ規則で守っている。
 *
 * スマホでは上から1列に並べる。広い画面（xl 以上。lg はサイドバーのぶん狭い）では、左にメンバーと操作ログ、
 * 右に招待を並べる。読み上げとキーボードの順は、スマホの並びと同じ（メンバー → 招待 → 操作ログ）。
 */
export default function VendorMembersPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useMembers();

  if (!user) return null;
  // 立場と権限は、読み込んだばかりの API の答え（data.me）を優先する。ログイン時に読んだ値（user.shopMembership）は、
  // 代表者を引き継いだあとなどに古くなる
  const membership = data?.me ?? user.shopMembership;
  const canManageMembers = hasShopPermission(membership, "members_manage");
  const canViewLogs = hasShopPermission(membership, "audit_view");
  // 招待を右に並べるときだけ広くする。並べるものが無ければ、読みやすい幅のまま
  const width = canManageMembers ? "wide" : "reading";

  return (
    <PageShell bottomNav={false}>
      <PageTitle title="メンバー管理" width={width} />
      <PageContainer width={width}>
        {loading ? (
          <CenteredLoading />
        ) : error || !data ? (
          <div role="alert" className="space-y-3 rounded-btn bg-status-critical-bg p-4 text-sm text-status-critical-fg ring-1 ring-status-critical-line">
            <p>{error ?? "メンバーを読み込めませんでした"}</p>
            <Button variant="quiet" onClick={() => void reload()}>
              もう一度読み込む
            </Button>
          </div>
        ) : (
          <div className={cn("grid gap-8", canManageMembers && "xl:grid-cols-[minmax(0,1fr)_22rem] xl:grid-rows-[auto_1fr] xl:items-start")}>
            <div className="min-w-0 xl:col-start-1 xl:row-start-1">
              <MembersSection
                data={data}
                onChanged={reload}
                // 引き継いだ直後は自分の権限が変わるので、メニューなども含めて画面を読み直す
                onTransferred={() => window.location.reload()}
              />
            </div>
            {canManageMembers && membership && (
              <div className="min-w-0 xl:col-start-2 xl:row-span-2 xl:row-start-1">
                <InvitesSection membership={membership} onChanged={reload} />
              </div>
            )}
            {canViewLogs && (
              <div className="min-w-0 xl:col-start-1 xl:row-start-2">
                <ActivityLogSection />
              </div>
            )}
          </div>
        )}
      </PageContainer>
    </PageShell>
  );
}
