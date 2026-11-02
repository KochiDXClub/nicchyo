"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonClass, CenteredLoading, PageContainer, PageShell, PageTitle, Surface } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthContext";
import { hasShopPermission } from "@/lib/vendor/shopPermissions";
import { useMembers } from "../members/useMembers";
import AccountSummary from "./components/AccountSummary";
import LeaveShopSection from "./components/LeaveShopSection";
import ProfileSection from "./components/ProfileSection";
import WithdrawSection from "./components/WithdrawSection";

/**
 * アカウント設定。あなたのアカウント → 名前と写真 → お店のメンバー（メンバー管理への入口）→ お店を抜ける → 退会、の順。
 * メンバーの一覧・招待・権限の変更・代表者の引き継ぎ・操作ログは「メンバー管理」（/vendor/members）にある。
 * ここでも立場（代表者か）とメンバーの人数が要る（抜ける・退会の案内が変わる）ので、メンバーを読み込む。
 */
export default function VendorAccountPage() {
  const { user, logout, updateProfile } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const { data, error, loading } = useMembers();

  if (!user) return null;
  // 立場と権限は、読み込んだばかりの API の答え（data.me）を優先する。ログイン時に読んだ値（user.shopMembership）は、
  // 代表者を引き継いだあとなどに古くなる
  const membership = data?.me ?? user.shopMembership;

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
            <section aria-labelledby="members-link-heading" className="space-y-3">
              <h2 id="members-link-heading" className="px-1 text-lg font-bold text-nicchyo-ink">
                お店のメンバー
              </h2>
              <Surface padding="md" className="space-y-3">
                <p className="text-sm leading-relaxed text-nicchyo-ink/70">
                  いま{data.members.length}人がお店に入っています。
                  {hasShopPermission(membership, "members_manage")
                    ? "メンバーの確認、家族やスタッフの招待、できることの変更、代表者の引き継ぎは「メンバー管理」でできます。"
                    : "誰がいて、それぞれ何ができるかは「メンバー管理」で見られます。"}
                </p>
                <Link href="/vendor/members" className={buttonClass({ variant: "secondary", className: "w-full" })}>
                  メンバー管理を開く
                </Link>
              </Surface>
            </section>
            <LeaveShopSection role={data.me.role} />
            <WithdrawSection role={data.me.role} hasOtherMembers={data.members.length > 1} />
          </>
        )}
      </PageContainer>
    </PageShell>
  );
}
