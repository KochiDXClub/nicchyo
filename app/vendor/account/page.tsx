"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CenteredLoading, PageContainer, PageShell, PageTitle } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthContext";
import { hasShopPermission } from "@/lib/vendor/shopPermissions";
import AccountSummary from "./components/AccountSummary";
import ActivityLogSection from "./components/ActivityLogSection";
import InvitesSection from "./components/InvitesSection";
import LeaveShopSection from "./components/LeaveShopSection";
import MembersSection from "./components/MembersSection";
import ProfileSection from "./components/ProfileSection";
import WithdrawSection from "./components/WithdrawSection";
import { useMembers } from "./useMembers";

/**
 * アカウント設定。あなたのアカウント → 名前と写真 → お店のメンバー → 招待 → 操作ログ → お店を抜ける → 退会、の順。
 * メンバーの管理（招待・権限の変更）と操作ログは、その権限がある人にだけ出す。
 * 権限の規則は lib/vendor/memberRules.ts で、API も同じ規則で守っている。
 */
export default function VendorAccountPage() {
  const { user, logout, updateProfile } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const { data, error, loading, reload } = useMembers();

  if (!user) return null;
  // 立場と権限は、読み込んだばかりの API の答え（data.me）を優先する。ログイン時に読んだ値（user.shopMembership）は、
  // 代表者を引き継いだあとなどに古くなる
  const membership = data?.me ?? user.shopMembership;
  const canManageMembers = hasShopPermission(membership, "members_manage");
  const canViewLogs = hasShopPermission(membership, "audit_view");

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.push("/login");
  };

  return (
    <PageShell bottomNav={false}>
      <PageTitle title="アカウント設定" />
      <PageContainer className="space-y-8">
        <AccountSummary user={user} membership={membership} onLogout={handleLogout} loggingOut={loggingOut} />

        <ProfileSection user={user} updateProfile={updateProfile} />

        {loading ? (
          <CenteredLoading />
        ) : error || !data ? (
          <p role="alert" className="rounded-btn bg-status-critical-bg p-3 text-sm text-status-critical-fg ring-1 ring-status-critical-line">
            {error ?? "メンバーを読み込めませんでした"}
          </p>
        ) : (
          <>
            <MembersSection
              data={data}
              onChanged={reload}
              // 引き継いだ直後は自分の権限が変わるので、メニューなども含めて画面を読み直す
              onTransferred={() => window.location.reload()}
            />
            {canManageMembers && membership && <InvitesSection membership={membership} onChanged={reload} />}
            {canViewLogs && <ActivityLogSection />}
            <LeaveShopSection role={data.me.role} />
            <WithdrawSection role={data.me.role} hasOtherMembers={data.members.length > 1} />
          </>
        )}
      </PageContainer>
    </PageShell>
  );
}
