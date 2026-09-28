"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/auth/types";
import { LoadingButton, EmptyState, ErrorBoundary, AdminLayout, AdminPageHeader } from "@/components/admin";
import { useKeyboardShortcuts, ShortcutHelp } from "@/lib/hooks/useKeyboardShortcuts";
import { Tooltip } from "@/components/admin/desktop/Tooltip";
import { useAdminUsers } from "./useAdminUsers";
import { UserTable } from "./UserTable";
import { RoleChangeModal } from "./RoleChangeModal";
import { InviteUserModal } from "./InviteUserModal";

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

  // キーボードショートカット
  useKeyboardShortcuts([
    {
      key: "a",
      ctrl: true,
      description: "全選択",
      action: u.handleSelectAll,
    },
    {
      key: "f",
      ctrl: true,
      description: "検索フォーカス",
      action: () => u.searchInputRef.current?.focus(),
    },
    {
      key: "/",
      description: "検索フォーカス",
      action: () => u.searchInputRef.current?.focus(),
    },
    {
      key: "e",
      ctrl: true,
      description: "CSV出力",
      action: u.handleExportCSV,
    },
    {
      key: "Delete",
      description: "選択したユーザーを削除",
      action: () => {
        if (u.selectedUserIds.length > 0) {
          u.handleBulkDelete();
        }
      },
    },
    {
      key: "?",
      description: "ショートカット一覧を表示",
      action: () => setShowShortcutHelp(true),
    },
  ]);

  if (!permissions.isAdmin) {
    return null;
  }

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="User Admin"
        title="ユーザー管理"
        actions={
          <>
            <LoadingButton
              onClick={u.handleExportCSV}
              isLoading={u.isExporting}
              loadingText="出力中..."
              className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 text-sm"
              aria-label="CSVファイルをエクスポート"
            >
              CSV出力
            </LoadingButton>
            <LoadingButton
              onClick={u.handleExportJSON}
              isLoading={u.isExporting}
              loadingText="出力中..."
              className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 text-sm"
              aria-label="JSONファイルをエクスポート"
            >
              JSON出力
            </LoadingButton>
            <button
              type="button"
              onClick={u.handleCreateUser}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              aria-label="新規ユーザーを追加"
            >
              + 新規ユーザー追加
            </button>
          </>
        }
      />

      {/* メインコンテンツ */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* 統計カード */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5 mb-6">
          <div className="rounded-lg bg-white p-4 shadow">
            <p className="text-sm text-gray-600">総ユーザー数</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{u.stats.total}</p>
          </div>
          <div className="rounded-lg bg-red-50 p-4 shadow">
            <p className="text-sm text-red-600">管理者</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{u.stats.admins}</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-4 shadow">
            <p className="text-sm text-blue-600">出店者</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{u.stats.vendors}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4 shadow">
            <p className="text-sm text-gray-600">一般ユーザー</p>
            <p className="mt-1 text-2xl font-bold text-gray-600">{u.stats.users}</p>
          </div>
          <div className="rounded-lg bg-orange-50 p-4 shadow">
            <p className="text-sm text-orange-600">停止中</p>
            <p className="mt-1 text-2xl font-bold text-orange-600">{u.stats.suspended}</p>
          </div>
        </div>

        {/* フィルターと検索 */}
        <div className="mb-6 rounded-lg bg-white p-4 shadow">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => u.setFilter("all")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  u.filter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                aria-label="すべてのユーザーを表示"
              >
                すべて ({u.stats.total})
              </button>
              <button
                type="button"
                onClick={() => u.setFilter("admin")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  u.filter === "admin"
                    ? "bg-red-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                aria-label="管理者のみ表示"
              >
                管理者 ({u.stats.admins})
              </button>
              <button
                type="button"
                onClick={() => u.setFilter("vendor")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  u.filter === "vendor"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                aria-label="出店者のみ表示"
              >
                出店者 ({u.stats.vendors})
              </button>
              <button
                type="button"
                onClick={() => u.setFilter("general_user")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  u.filter === "general_user"
                    ? "bg-gray-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                aria-label="一般ユーザーのみ表示"
              >
                一般 ({u.stats.users})
              </button>
              <button
                type="button"
                onClick={() => u.setFilter("suspended")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  u.filter === "suspended"
                    ? "bg-orange-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                aria-label="停止中のユーザーのみ表示"
              >
                停止中 ({u.stats.suspended})
              </button>
            </div>
            <div className="flex items-center gap-4">
              <input
                ref={u.searchInputRef}
                id="user-search"
                type="text"
                placeholder="名前・メールアドレスで検索... (Ctrl+F または /)"
                value={u.searchQuery}
                onChange={(e) => u.setSearchQuery(e.target.value)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none w-80"
                aria-label="名前またはメールアドレスで検索"
              />
            </div>
          </div>
        </div>

        {/* 一括操作ツールバー */}
        {u.selectedUserIds.length > 0 && (
          <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4 shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-blue-900">
                  {u.selectedUserIds.length}人選択中
                </span>
                <button
                  type="button"
                  onClick={() => u.setSelectedUserIds([])}
                  className="text-sm text-blue-600 hover:text-blue-800"
                  aria-label="選択を解除"
                >
                  選択解除
                </button>
              </div>
              <div className="flex gap-2">
                <LoadingButton
                  onClick={u.handleBulkActivate}
                  isLoading={u.bulkLoading}
                  loadingText="処理中..."
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  aria-label="選択したユーザーを一括アクティブ化"
                >
                  一括アクティブ化
                </LoadingButton>
                <LoadingButton
                  onClick={u.handleBulkSuspend}
                  isLoading={u.bulkLoading}
                  loadingText="処理中..."
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
                  aria-label="選択したユーザーを一括停止"
                >
                  一括停止
                </LoadingButton>
                <LoadingButton
                  onClick={u.handleBulkDelete}
                  isLoading={u.bulkLoading}
                  loadingText="削除中..."
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  aria-label="選択したユーザーを一括削除"
                >
                  一括削除
                </LoadingButton>
              </div>
            </div>
          </div>
        )}

        {/* ユーザーリスト */}
        {u.isLoadingUsers ? (
          <div className="rounded-lg bg-white p-8 shadow">
            <p className="text-sm text-gray-500">ユーザーデータを読み込んでいます...</p>
          </div>
        ) : u.loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-8 shadow">
            <p className="text-sm text-red-700">{u.loadError}</p>
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
          <UserTable
            sortedData={u.sortedData}
            sortKey={u.sortKey}
            sortDirection={u.sortDirection}
            onSort={u.handleSort}
            selectedUserIds={u.selectedUserIds}
            filteredUsersCount={u.filteredUsers.length}
            onSelectAll={u.handleSelectAll}
            onSelectUser={u.handleSelectUser}
            parentRef={u.parentRef}
            rowVirtualizer={u.rowVirtualizer}
            getRoleBadge={u.getRoleBadge}
            getRoleLabel={u.getRoleLabel}
            onOpenRoleChange={u.handleOpenRoleChange}
            onSuspendUser={u.handleSuspendUser}
            onRestoreUser={u.handleRestoreUser}
          />
        )}
      </div>

      {/* 権限変更モーダル */}
      {u.roleChangeUser && (
        <RoleChangeModal
          user={u.roleChangeUser}
          newRole={u.newRole}
          onNewRoleChange={u.setNewRole}
          getRoleBadge={u.getRoleBadge}
          getRoleLabel={u.getRoleLabel}
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
          onRoleChange={(role: UserRole) => u.setInviteRole(role)}
          isLoading={u.inviteLoading}
          onSubmit={u.handleInviteSubmit}
          onClose={() => u.setShowInviteModal(false)}
        />
      )}

      {/* キーボードショートカットヘルプボタン */}
      <Tooltip content="キーボードショートカット (?)">
        <button
          type="button"
          onClick={() => setShowShortcutHelp(true)}
          className="fixed bottom-8 right-8 w-12 h-12 bg-gray-800 hover:bg-gray-700 text-white rounded-full shadow-lg flex items-center justify-center z-40 transition"
          aria-label="キーボードショートカット一覧を表示"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </Tooltip>

      {/* キーボードショートカットヘルプモーダル */}
      {showShortcutHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowShortcutHelp(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">キーボードショートカット</h3>
              <button
                type="button"
                onClick={() => setShowShortcutHelp(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="閉じる"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ShortcutHelp
              shortcuts={[
                { key: "a", ctrl: true, description: "全選択" },
                { key: "f", ctrl: true, description: "検索フォーカス" },
                { key: "/", description: "検索フォーカス" },
                { key: "e", ctrl: true, description: "CSV出力" },
                { key: "Delete", description: "選択したユーザーを削除" },
                { key: "?", description: "このヘルプを表示" },
              ].map(s => ({ ...s, action: () => {} }))}
            />
          </div>
        </div>
      )}
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
