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
  FilterChip,
  ShortcutHelpLauncher,
  StatusBadge,
  type DataColumn,
} from "@/components/admin";
import { Plus, Search } from "lucide-react";
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

  const renderUserActions = (user: AdminUser, size: "sm" | "md" = "sm") => (
    <>
      <Button variant="quiet" size={size} onClick={() => u.handleOpenRoleChange(user)} aria-label={`${user.name}の権限を変更`}>
        権限変更
      </Button>
      {user.status === "active" ? (
        <Button variant="quiet" size={size} className={DANGER} onClick={() => u.handleSuspendUser(user)} aria-label={`${user.name}を停止`}>
          停止
        </Button>
      ) : (
        <Button variant="quiet" size={size} onClick={() => u.handleRestoreUser(user)} aria-label={`${user.name}を復帰`}>
          復帰
        </Button>
      )}
    </>
  );

  return (
    // 画面いっぱいの高さに収め、スクロールは表の本体だけにする（Supabase の Users と同じ形）
    <AdminLayout withBottomPadding={false}>
      <div className="flex h-[100dvh] flex-col">
      <div className="shrink-0">
        <AdminPageHeader
          eyebrow="User Admin"
          title="ユーザー管理"
          actions={
            <>
              <Button className="flex-1 px-4 sm:flex-none" onClick={u.handleCreateUser} aria-label="新規ユーザーを追加">
                <Plus size={18} aria-hidden="true" />
                ユーザーを追加
              </Button>
              <ExportActions compact onCsv={u.exportCsv} onJson={u.exportJson} loading={u.isExporting} />
            </>
          }
        />
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 pb-24 pt-3 sm:pb-4 sm:pt-4">
        {/* 件数・検索・絞り込みを、できるだけ少ない段で収める */}
        {/* 絞り込み（左）と検索（右）を一行に並べる。PC では一行に収まり、スマホでは検索が次の段に回る */}
        <div className="mb-3 flex shrink-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div role="group" aria-label="状態で絞り込む" className="flex min-w-0 flex-wrap gap-2">
            {[
              { key: "all", label: "すべて", count: u.stats.total },
              { key: "admin", label: "管理者", count: u.stats.admins },
              { key: "vendor", label: "出店者", count: u.stats.vendors },
              { key: "general_user", label: "一般", count: u.stats.users },
              { key: "suspended", label: "停止中", count: u.stats.suspended },
            ].map((f) => (
              <FilterChip key={f.key} active={f.key === u.filter} onClick={() => u.setFilter(f.key as typeof u.filter)}>
                {f.label}
                <span className="ml-1 tabular-nums">({f.count})</span>
              </FilterChip>
            ))}
          </div>
          <div className="relative w-full shrink-0 lg:w-80">
            <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-nicchyo-ink/40" />
            <input
              ref={u.searchInputRef}
              type="search"
              aria-label="名前・メールアドレスで検索"
              placeholder="名前・メールアドレスで検索... (/)"
              value={u.searchQuery}
              onChange={(e) => u.setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-btn border border-line bg-white pl-9 pr-3 text-base text-nicchyo-ink placeholder:text-nicchyo-ink/40 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 sm:h-10 sm:text-sm"
            />
          </div>
        </div>

        <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 text-sm text-nicchyo-ink/70 sm:hidden">
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={u.selection.allSelected} onChange={u.selection.toggleAll} disabled={u.sortedData.length === 0} className="h-5 w-5 accent-amber-600" />
            表示中をすべて選択
          </label>
          <span aria-live="polite">{u.filteredUsers.length}人</span>
          <div className="flex w-full items-center gap-2">
            <label htmlFor="mobile-user-sort" className="shrink-0">並び順</label>
            <select id="mobile-user-sort" value={u.sortKey ?? "name"} onChange={(event) => u.handleSort(event.target.value)} className="h-11 min-w-0 flex-1 rounded-btn border border-line bg-white px-3 text-sm text-nicchyo-ink">
              {columns.filter((column) => column.sortKey).map((column) => <option key={column.key} value={column.sortKey}>{column.header}</option>)}
            </select>
            <Button variant="quiet" className="shrink-0 px-3" onClick={() => u.handleSort(u.sortKey ?? "name")} aria-label="並び順を反転">
              {u.sortDirection === "asc" ? "昇順 ↑" : "降順 ↓"}
            </Button>
          </div>
        </div>

        <div className="shrink-0">
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
        </div>

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
            fillHeight
            actions={(user) => renderUserActions(user)}
            mobileLayout="list"
            mobileCard={(user, index) => (
              <div className="flex items-start gap-2 px-3 py-3">
                <label className="flex h-11 w-11 shrink-0 items-center justify-center">
                  <input type="checkbox" aria-label={`ユーザー「${user.name}」を選択`} checked={u.selection.isSelected(user.id)} onChange={() => u.selection.toggle(user.id, index)} className="h-5 w-5 accent-amber-600" />
                </label>
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold text-nicchyo-ink">{user.name}</p>
                  <p className="break-all text-sm text-nicchyo-ink/55">{user.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant={ROLE_BADGE_VARIANT[user.role]}>{ROLE_LABEL[user.role]}</Badge>
                    {user.status === "suspended" && <StatusBadge status="suspended" customLabel="停止中" />}
                  </div>
                  {user.vendorId && <p className="mt-1 text-xs text-nicchyo-ink/55">店舗ID: {user.vendorId}</p>}
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="text-nicchyo-ink/55">登録日</dt><dd className="mt-0.5 break-words text-nicchyo-ink">{user.registeredDate}</dd></div>
                    <div><dt className="text-nicchyo-ink/55">最終ログイン</dt><dd className="mt-0.5 break-words text-nicchyo-ink">{user.lastLogin}</dd></div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2">{renderUserActions(user, "md")}</div>
                </div>
              </div>
            )}
          />
        )}
      </div>
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
