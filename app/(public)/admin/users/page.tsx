"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import {
  AdminDataTable,
  AdminLayout,
  AdminPageHeader,
  BulkActionBar,
  EmptyState,
  ErrorBoundary,
  ExportActions,
  ReviewStats,
  ReviewToolbar,
  ShortcutHelpLauncher,
  StatusBadge,
  type DataColumn,
} from "@/components/admin";
import { Badge, Button } from "@/components/ui";
import { CenteredLoading } from "@/components/ui/loading-spinner";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useAdminUsers, type AdminUser } from "./useAdminUsers";
import { RoleChangeModal } from "./RoleChangeModal";
import { InviteUserModal } from "./InviteUserModal";
import { ROLE_BADGE_VARIANT, ROLE_LABEL } from "./roles";

const DANGER = "text-rose-700 hover:bg-rose-50";

function AdminUsersContent() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

  // 管理者権限チェック
  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isAdmin) {
      router.push("/");
    }
  }, [isLoading, permissions.isAdmin, router]);

  const u = useAdminUsers({ isAdmin: permissions.isAdmin });

  const shortcuts = [
    { key: "a", ctrl: true, description: "全選択", action: u.selection.toggleAll },
    { key: "f", ctrl: true, description: "検索フォーカス", action: () => u.searchInputRef.current?.focus() },
    { key: "/", description: "検索フォーカス", action: () => u.searchInputRef.current?.focus() },
    { key: "e", ctrl: true, description: "CSV出力", action: u.exportCsv },
    {
      key: "Delete",
      description: "選択したユーザーを削除",
      action: () => {
        if (u.selection.selectedIds.length > 0) void u.handleBulk("delete", "削除");
      },
    },
    { key: "?", description: "ショートカット一覧を表示", action: () => setShowShortcutHelp(true) },
  ];
  useKeyboardShortcuts(shortcuts);

  if (!permissions.isAdmin) {
    return null;
  }

  const columns: DataColumn<AdminUser>[] = [
    {
      key: "name",
      header: "ユーザー",
      sortKey: "name",
      className: "w-[30%]",
      render: (user) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-nicchyo-ink/[0.06]">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.name} className="h-10 w-10 rounded-full" />
            ) : (
              <span className="text-xl text-nicchyo-ink/40" aria-hidden="true">
                👤
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium text-nicchyo-ink">{user.name}</div>
            <div className="truncate text-sm text-nicchyo-ink/55">{user.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "ロール",
      sortKey: "role",
      className: "w-36",
      render: (user) => (
        <>
          <Badge variant={ROLE_BADGE_VARIANT[user.role]}>{ROLE_LABEL[user.role]}</Badge>
          {user.vendorId && <div className="mt-1 text-xs text-nicchyo-ink/55">店舗ID: {user.vendorId}</div>}
        </>
      ),
    },
    { key: "registeredDate", header: "登録日", sortKey: "registeredDate", className: "w-32 whitespace-nowrap", render: (user) => user.registeredDate },
    { key: "lastLogin", header: "最終ログイン", sortKey: "lastLogin", className: "w-40 whitespace-nowrap", render: (user) => user.lastLogin },
    {
      key: "status",
      header: "ステータス",
      sortKey: "status",
      className: "w-32",
      render: (user) => (
        <StatusBadge
          status={user.status === "active" ? "active" : "suspended"}
          customLabel={user.status === "active" ? "アクティブ" : "停止中"}
        />
      ),
    },
  ];

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="User Admin"
        title="ユーザー管理"
        actions={
          <>
            <ExportActions onCsv={u.exportCsv} onJson={u.exportJson} loading={u.isExporting} />
            <Button size="sm" onClick={u.handleCreateUser} aria-label="新規ユーザーを追加">
              + 新規ユーザー追加
            </Button>
          </>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-8 pb-20">
        <ReviewStats
          items={[
            { label: "総ユーザー数", value: u.stats.total },
            { label: "管理者", value: u.stats.admins, tone: "critical" },
            { label: "出店者", value: u.stats.vendors, tone: "info" },
            { label: "一般ユーザー", value: u.stats.users, tone: "muted" },
            { label: "停止中", value: u.stats.suspended, tone: "warning" },
          ]}
        />

        <ReviewToolbar
          ref={u.searchInputRef}
          filters={[
            { key: "all", label: "すべて", count: u.stats.total },
            { key: "admin", label: "管理者", count: u.stats.admins },
            { key: "vendor", label: "出店者", count: u.stats.vendors },
            { key: "general_user", label: "一般", count: u.stats.users },
            { key: "suspended", label: "停止中", count: u.stats.suspended },
          ]}
          value={u.filter}
          onChange={u.setFilter}
          search={{ value: u.searchQuery, onChange: u.setSearchQuery, placeholder: "名前・メールアドレスで検索... (/)" }}
        />

        <BulkActionBar count={u.selection.selectedIds.length} unit="人" onClear={u.selection.clear}>
          <Button variant="quiet" size="sm" onClick={() => u.handleBulk("restore", "アクティブ化")} disabled={u.bulkLoading}>
            一括アクティブ化
          </Button>
          <Button variant="quiet" size="sm" onClick={() => u.handleBulk("suspend", "停止")} disabled={u.bulkLoading}>
            一括停止
          </Button>
          <Button variant="quiet" size="sm" className={DANGER} onClick={() => u.handleBulk("delete", "削除")} disabled={u.bulkLoading}>
            一括削除
          </Button>
        </BulkActionBar>

        {u.isLoadingUsers ? (
          <CenteredLoading padding="py-16" className="text-nicchyo-ink/40" />
        ) : u.loadError ? (
          <div role="alert" className="rounded-card bg-status-critical-bg p-6 text-sm text-status-critical-fg ring-1 ring-status-critical-line">
            {u.loadError}
          </div>
        ) : u.filteredUsers.length === 0 ? (
          <EmptyState
            icon="👥"
            title="ユーザーが見つかりません"
            description={
              u.debouncedSearchQuery
                ? "検索条件に一致するユーザーがありません。別のキーワードで検索してください。"
                : "現在、この条件に該当するユーザーはいません。"
            }
            action={{
              label: "新規ユーザーを追加",
              onClick: u.handleCreateUser,
            }}
          />
        ) : (
          <AdminDataTable
            rows={u.sortedData}
            getRowId={(user) => user.id}
            columns={columns}
            sort={{ key: u.sortKey, direction: u.sortDirection, onSort: u.handleSort }}
            selection={u.selection}
            selectionLabel={(user) => `ユーザー「${user.name}」を選択`}
            selectAllLabel="表示中のユーザーをすべて選択"
            virtualize
            actions={(user) => (
              <>
                <Button variant="quiet" size="sm" onClick={() => u.handleOpenRoleChange(user)} aria-label={`${user.name}の権限を変更`}>
                  権限変更
                </Button>
                {user.status === "active" ? (
                  <Button variant="quiet" size="sm" className={DANGER} onClick={() => u.handleSuspendUser(user)} aria-label={`${user.name}を停止`}>
                    停止
                  </Button>
                ) : (
                  <Button variant="quiet" size="sm" onClick={() => u.handleRestoreUser(user)} aria-label={`${user.name}を復帰`}>
                    復帰
                  </Button>
                )}
              </>
            )}
          />
        )}
      </div>

      {/* 権限変更モーダル */}
      {u.roleChangeUser && (
        <RoleChangeModal
          user={u.roleChangeUser}
          newRole={u.newRole}
          onNewRoleChange={u.setNewRole}
          onSubmit={u.handleRoleChange}
          onClose={() => u.setRoleChangeUser(null)}
        />
      )}

      {/* ユーザー招待モーダル */}
      {u.showInviteModal && (
        <InviteUserModal
          email={u.inviteEmail}
          onEmailChange={u.setInviteEmail}
          role={u.inviteRole}
          onRoleChange={u.setInviteRole}
          isLoading={u.inviteLoading}
          onSubmit={u.handleInviteSubmit}
          onClose={() => u.setShowInviteModal(false)}
        />
      )}

      <ShortcutHelpLauncher shortcuts={shortcuts} open={showShortcutHelp} onOpenChange={setShowShortcutHelp} />
    </AdminLayout>
  );
}

export default function AdminUsersPage() {
  return (
    <ErrorBoundary>
      <AdminUsersContent />
    </ErrorBoundary>
  );
}
