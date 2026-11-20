"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { History, Users, UserPlus } from "lucide-react";
import { Button, CenteredLoading, PageContainer, PageShell, PageTitle } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/utils/cn";
import { hasShopPermission } from "@/lib/vendor/shopPermissions";
import ActivityLogSection from "./components/ActivityLogSection";
import InvitesSection from "./components/InvitesSection";
import MembersSection from "./components/MembersSection";
import { useMembers } from "./useMembers";

const views = [
  { id: "members", label: "メンバー", icon: Users },
  { id: "invites", label: "招待", icon: UserPlus },
  { id: "logs", label: "操作ログ", icon: History },
] as const;

export default function VendorMembersPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useMembers();

  const [selected, select] = useState<(typeof views)[number]["id"]>("members");

  const [inviteOpened, setInviteOpened] = useState(false);

  if (!user) return null;
  // 立場と権限は、読み込んだばかりの API の答え（data.me）を優先する。ログイン時に読んだ値（user.shopMembership）は、
  // 代表者を引き継いだあとなどに古くなる
  const membership = data?.me ?? user.shopMembership;
  const canManageMembers = hasShopPermission(membership, "members_manage");
  const canViewLogs = hasShopPermission(membership, "audit_view");
  const available = views.filter(({ id }) => id === "members" || (id === "invites" ? canManageMembers : canViewLogs));
  const current = available.some(({ id }) => id === selected) ? selected : "members";

  return (
    <PageShell bottomNav={false} className="min-h-0">
      <PageTitle title="メンバー管理" width="reading" />
      <PageContainer width="reading">
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
          <div className="space-y-4">
            {available.length > 1 && (
              <div role="group" aria-label="表示する内容" className="sticky top-[var(--safe-top,0px)] z-10 flex gap-1 rounded-card bg-white p-1 shadow-card ring-1 ring-line">
                {available.map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" aria-pressed={current === id} onClick={() => {
                    select(id);
                    if (id === "invites") setInviteOpened(true);
                  }}
                    className={cn("flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-btn text-sm font-bold",
                      current === id ? "bg-amber-100 text-amber-900" : "text-nicchyo-ink/70 hover:bg-nicchyo-base")}>
                    <Icon size={16} aria-hidden />{label}
                  </button>
                ))}
              </div>
            )}
            {current === "members" && (
              <MembersSection
                data={data}
                onChanged={reload}
                // 引き継いだ直後は自分の権限が変わるので、メニューなども含めて画面を読み直す
                onTransferred={() => window.location.reload()}
              />
            )}
            {inviteOpened && canManageMembers && membership && (
              <div hidden={current !== "invites"}>
                <InvitesSection membership={membership} inviterName={user.name} onChanged={reload} />
              </div>
            )}
            {current === "logs" && <ActivityLogSection />}
          </div>
        )}
      </PageContainer>
    </PageShell>
  );
}
