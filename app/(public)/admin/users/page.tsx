"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/auth/types";
import { exportToCSV, exportToJSON, formatDateForFilename } from "@/lib/admin/exportUtils";
import { showToast } from "@/lib/admin/toast";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDebounce } from "use-debounce";
import { StatusBadge, LoadingButton, EmptyState, ErrorBoundary, AdminLayout, AdminPageHeader } from "@/components/admin";
import { useKeyboardShortcuts, ShortcutHelp } from "@/lib/hooks/useKeyboardShortcuts";
import { SortableTableHeader, useSortableData } from "@/components/admin/desktop/SortableTableHeader";
import { Tooltip } from "@/components/admin/desktop/Tooltip";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  vendorId?: string;
  registeredDate: string;
  lastLogin: string;
  status: "active" | "suspended";
}

function AdminUsersContent() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | UserRole | "suspended">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [roleChangeUser, setRoleChangeUser] = useState<AdminUser | null>(null);
  const [newRole, setNewRole] = useState<UserRole>("general_user");
  const [isExporting, setIsExporting] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("general_user");
  const [inviteLoading, setInviteLoading] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // 管理者権限チェック
  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isAdmin) {
      router.push("/");
    }
  }, [isLoading, permissions.isAdmin, router]);

  useEffect(() => {
    if (!permissions.isAdmin) {
      setIsLoadingUsers(false);
      return;
    }

    let active = true;
    setIsLoadingUsers(true);
    setLoadError(null);

    void fetch("/api/admin/users")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("failed");
        }
        return response.json() as Promise<{ users?: AdminUser[] }>;
      })
      .then((data) => {
        if (!active) return;
        setUsers(Array.isArray(data.users) ? data.users : []);
      })
      .catch(() => {
        if (!active) return;
        setLoadError("ユーザーデータの取得に失敗しました。");
      })
      .finally(() => {
        if (active) setIsLoadingUsers(false);
      });

    return () => {
      active = false;
    };
  }, [permissions.isAdmin]);

  // フィルタリング（メモ化）
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "suspended" && user.status === "suspended") ||
        (filter !== "suspended" && user.role === filter);
      const matchesSearch =
        debouncedSearchQuery === "" ||
        user.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [users, filter, debouncedSearchQuery]);

  // ソート機能
  const { sortedData, sortKey, sortDirection, handleSort } = useSortableData(filteredUsers, "name");

  // 統計（メモ化）
  const stats = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((u) => u.role === "admin").length,
      vendors: users.filter((u) => u.role === "vendor").length,
      users: users.filter((u) => u.role === "general_user").length,
      suspended: users.filter((u) => u.status === "suspended").length,
    }),
    [users]
  );

  // Virtual scrolling setup
  const parentRef = useRef<HTMLTableSectionElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 5,
  });

  const getRoleBadge = useCallback((role: UserRole) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "vendor":
        return "bg-blue-100 text-blue-800";
      case "general_user":
        return "bg-gray-100 text-gray-800";
      case "moderator":
        return "bg-purple-100 text-purple-800";
    }
  }, []);

  const getRoleLabel = useCallback((role: UserRole) => {
    switch (role) {
      case "admin":
        return "管理者";
      case "vendor":
        return "出店者";
      case "general_user":
        return "一般";
      case "moderator":
        return "モデレーター";
    }
  }, []);

  // チェックボックス操作
  const handleSelectAll = useCallback(() => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map((user) => user.id));
    }
  }, [selectedUserIds.length, filteredUsers]);

  const handleSelectUser = useCallback(
    (userId: string, index: number, shiftKey: boolean) => {
      if (shiftKey && lastSelectedIndex !== null) {
        // Shift+クリックで範囲選択
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        const rangeIds = sortedData.slice(start, end + 1).map((user) => user.id);

        setSelectedUserIds((prev) => {
          const newSet = new Set(prev);
          rangeIds.forEach((id) => newSet.add(id));
          return Array.from(newSet);
        });
      } else {
        // 通常のクリックでトグル
        if (selectedUserIds.includes(userId)) {
          setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
        } else {
          setSelectedUserIds([...selectedUserIds, userId]);
        }
        setLastSelectedIndex(index);
      }
    },
    [selectedUserIds, lastSelectedIndex, sortedData]
  );

  const reloadUsers = useCallback(() => {
    setIsLoadingUsers(true);
    setLoadError(null);
    void fetch("/api/admin/users")
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return response.json() as Promise<{ users?: AdminUser[] }>;
      })
      .then((data) => {
        setUsers(Array.isArray(data.users) ? data.users : []);
      })
      .catch(() => {
        setLoadError("ユーザーデータの取得に失敗しました。");
      })
      .finally(() => {
        setIsLoadingUsers(false);
      });
  }, []);

  // 一括操作
  const handleBulkActivate = useCallback(async () => {
    if (selectedUserIds.length === 0) return;
    if (!confirm(`${selectedUserIds.length}人のユーザーを一括アクティブ化しますか？`)) return;

    setBulkLoading(true);
    try {
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", ids: selectedUserIds }),
      });
      if (!res.ok) throw new Error("failed");
      showToast.success(`${selectedUserIds.length}人のユーザーをアクティブ化しました`);
      setSelectedUserIds([]);
      reloadUsers();
    } catch {
      showToast.error("一括アクティブ化に失敗しました");
    } finally {
      setBulkLoading(false);
    }
  }, [selectedUserIds, reloadUsers]);

  const handleBulkSuspend = useCallback(async () => {
    if (selectedUserIds.length === 0) return;
    if (!confirm(`${selectedUserIds.length}人のユーザーを一括停止しますか？`)) return;

    setBulkLoading(true);
    try {
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suspend", ids: selectedUserIds }),
      });
      if (!res.ok) throw new Error("failed");
      showToast.success(`${selectedUserIds.length}人のユーザーを停止しました`);
      setSelectedUserIds([]);
      reloadUsers();
    } catch {
      showToast.error("一括停止に失敗しました");
    } finally {
      setBulkLoading(false);
    }
  }, [selectedUserIds, reloadUsers]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedUserIds.length === 0) return;
    if (
      !confirm(`${selectedUserIds.length}人のユーザーを一括削除しますか？この操作は取り消せません。`)
    )
      return;

    setBulkLoading(true);
    try {
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: selectedUserIds }),
      });
      if (!res.ok) throw new Error("failed");
      showToast.success(`${selectedUserIds.length}人のユーザーを削除しました`);
      setSelectedUserIds([]);
      reloadUsers();
    } catch {
      showToast.error("一括削除に失敗しました");
    } finally {
      setBulkLoading(false);
    }
  }, [selectedUserIds, reloadUsers]);

  // エクスポート
  const handleExportCSV = useCallback(async () => {
    setIsExporting(true);
    try {
      const dataToExport = filteredUsers.map((user) => ({
        ID: user.id,
        名前: user.name,
        メールアドレス: user.email,
        ロール: getRoleLabel(user.role),
        店舗ID: user.vendorId?.toString() || "",
        登録日: user.registeredDate,
        最終ログイン: user.lastLogin,
        ステータス: user.status === "active" ? "アクティブ" : "停止中",
      }));
      const filename = `users_${formatDateForFilename()}.csv`;
      const result = exportToCSV(dataToExport, filename);
      if (result.success) {
        showToast.success("CSVファイルをエクスポートしました");
      } else {
        showToast.error(result.error || "エクスポートに失敗しました");
      }
    } catch (_error) {
      showToast.error("エクスポートに失敗しました");
    } finally {
      setIsExporting(false);
    }
  }, [filteredUsers, getRoleLabel]);

  const handleExportJSON = useCallback(async () => {
    setIsExporting(true);
    try {
      const filename = `users_${formatDateForFilename()}.json`;
      const result = exportToJSON(filteredUsers, filename);
      if (result.success) {
        showToast.success("JSONファイルをエクスポートしました");
      } else {
        showToast.error(result.error || "エクスポートに失敗しました");
      }
    } catch (_error) {
      showToast.error("エクスポートに失敗しました");
    } finally {
      setIsExporting(false);
    }
  }, [filteredUsers]);

  const handleSuspendUser = useCallback(async (user: AdminUser) => {
    if (!confirm(`「${user.name}」を停止しますか？`)) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suspend" }),
      });
      if (!res.ok) throw new Error("failed");
      showToast.success(`${user.name}を停止しました`);
      reloadUsers();
    } catch {
      showToast.error("停止に失敗しました");
    }
  }, [reloadUsers]);

  const handleRestoreUser = useCallback(async (user: AdminUser) => {
    if (!confirm(`「${user.name}」を復帰しますか？`)) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      if (!res.ok) throw new Error("failed");
      showToast.success(`${user.name}を復帰しました`);
      reloadUsers();
    } catch {
      showToast.error("復帰に失敗しました");
    }
  }, [reloadUsers]);

  const handleCreateUser = useCallback(() => {
    setInviteEmail("");
    setInviteRole("general_user");
    setShowInviteModal(true);
  }, []);

  const handleInviteSubmit = useCallback(async () => {
    if (!inviteEmail) return;
    setInviteLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "failed");
      showToast.success(`${inviteEmail} に招待メールを送信しました`);
      setShowInviteModal(false);
      reloadUsers();
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "招待に失敗しました");
    } finally {
      setInviteLoading(false);
    }
  }, [inviteEmail, inviteRole, reloadUsers]);

  // 権限変更
  const handleOpenRoleChange = useCallback((user: AdminUser) => {
    setRoleChangeUser(user);
    setNewRole(user.role);
  }, []);

  const handleRoleChange = useCallback(async () => {
    if (!roleChangeUser) return;
    if (roleChangeUser.role === newRole) {
      showToast.error("同じロールが選択されています");
      return;
    }
    if (
      !confirm(
        `${roleChangeUser.name}のロールを「${getRoleLabel(roleChangeUser.role)}」から「${getRoleLabel(newRole)}」に変更しますか？`
      )
    )
      return;

    try {
      const res = await fetch(`/api/admin/users/${roleChangeUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_role", role: newRole }),
      });
      if (!res.ok) throw new Error("failed");
      showToast.success(`${roleChangeUser.name}のロールを「${getRoleLabel(newRole)}」に変更しました`);
      setRoleChangeUser(null);
      reloadUsers();
    } catch {
      showToast.error("ロール変更に失敗しました");
    }
  }, [roleChangeUser, newRole, getRoleLabel, reloadUsers]);

  // キーボードショートカット
  useKeyboardShortcuts([
    {
      key: "a",
      ctrl: true,
      description: "全選択",
      action: handleSelectAll,
    },
    {
      key: "f",
      ctrl: true,
      description: "検索フォーカス",
      action: () => searchInputRef.current?.focus(),
    },
    {
      key: "/",
      description: "検索フォーカス",
      action: () => searchInputRef.current?.focus(),
    },
    {
      key: "e",
      ctrl: true,
      description: "CSV出力",
      action: handleExportCSV,
    },
    {
      key: "Delete",
      description: "選択したユーザーを削除",
      action: () => {
        if (selectedUserIds.length > 0) {
          handleBulkDelete();
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
              onClick={handleExportCSV}
              isLoading={isExporting}
              loadingText="出力中..."
              className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 text-sm"
              aria-label="CSVファイルをエクスポート"
            >
              CSV出力
            </LoadingButton>
            <LoadingButton
              onClick={handleExportJSON}
              isLoading={isExporting}
              loadingText="出力中..."
              className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 text-sm"
              aria-label="JSONファイルをエクスポート"
            >
              JSON出力
            </LoadingButton>
            <button
              type="button"
              onClick={handleCreateUser}
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
            <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="rounded-lg bg-red-50 p-4 shadow">
            <p className="text-sm text-red-600">管理者</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{stats.admins}</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-4 shadow">
            <p className="text-sm text-blue-600">出店者</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{stats.vendors}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4 shadow">
            <p className="text-sm text-gray-600">一般ユーザー</p>
            <p className="mt-1 text-2xl font-bold text-gray-600">{stats.users}</p>
          </div>
          <div className="rounded-lg bg-orange-50 p-4 shadow">
            <p className="text-sm text-orange-600">停止中</p>
            <p className="mt-1 text-2xl font-bold text-orange-600">{stats.suspended}</p>
          </div>
        </div>

        {/* フィルターと検索 */}
        <div className="mb-6 rounded-lg bg-white p-4 shadow">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  filter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                aria-label="すべてのユーザーを表示"
              >
                すべて ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setFilter("admin")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  filter === "admin"
                    ? "bg-red-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                aria-label="管理者のみ表示"
              >
                管理者 ({stats.admins})
              </button>
              <button
                type="button"
                onClick={() => setFilter("vendor")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  filter === "vendor"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                aria-label="出店者のみ表示"
              >
                出店者 ({stats.vendors})
              </button>
              <button
                type="button"
                onClick={() => setFilter("general_user")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  filter === "general_user"
                    ? "bg-gray-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                aria-label="一般ユーザーのみ表示"
              >
                一般 ({stats.users})
              </button>
              <button
                type="button"
                onClick={() => setFilter("suspended")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  filter === "suspended"
                    ? "bg-orange-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                aria-label="停止中のユーザーのみ表示"
              >
                停止中 ({stats.suspended})
              </button>
            </div>
            <div className="flex items-center gap-4">
              <input
                ref={searchInputRef}
                id="user-search"
                type="text"
                placeholder="名前・メールアドレスで検索... (Ctrl+F または /)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none w-80"
                aria-label="名前またはメールアドレスで検索"
              />
            </div>
          </div>
        </div>

        {/* 一括操作ツールバー */}
        {selectedUserIds.length > 0 && (
          <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4 shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-blue-900">
                  {selectedUserIds.length}人選択中
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedUserIds([])}
                  className="text-sm text-blue-600 hover:text-blue-800"
                  aria-label="選択を解除"
                >
                  選択解除
                </button>
              </div>
              <div className="flex gap-2">
                <LoadingButton
                  onClick={handleBulkActivate}
                  isLoading={bulkLoading}
                  loadingText="処理中..."
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  aria-label="選択したユーザーを一括アクティブ化"
                >
                  一括アクティブ化
                </LoadingButton>
                <LoadingButton
                  onClick={handleBulkSuspend}
                  isLoading={bulkLoading}
                  loadingText="処理中..."
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
                  aria-label="選択したユーザーを一括停止"
                >
                  一括停止
                </LoadingButton>
                <LoadingButton
                  onClick={handleBulkDelete}
                  isLoading={bulkLoading}
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
        {isLoadingUsers ? (
          <div className="rounded-lg bg-white p-8 shadow">
            <p className="text-sm text-gray-500">ユーザーデータを読み込んでいます...</p>
          </div>
        ) : loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-8 shadow">
            <p className="text-sm text-red-700">{loadError}</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon="👥"
            title="ユーザーが見つかりません"
            description={
              debouncedSearchQuery
                ? "検索条件に一致するユーザーがありません。別のキーワードで検索してください。"
                : "現在、この条件に該当するユーザーはいません。"
            }
            action={{
              label: "新規ユーザーを追加",
              onClick: handleCreateUser,
            }}
          />
        ) : (
          <div className="rounded-lg bg-white shadow">
            <div className="overflow-x-auto">
              <div className="w-full" role="table">
                <div className="bg-gray-50" role="rowgroup">
                  <div className="flex" role="row">
                    <div className="px-6 py-3 text-left" style={{ flex: "0 0 80px" }} role="columnheader">
                      <Tooltip content="すべてのユーザーを選択/解除 (Ctrl+A)" position="top">
                        <input
                          type="checkbox"
                          checked={
                            selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0
                          }
                          onChange={handleSelectAll}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          aria-label="すべてのユーザーを選択/解除"
                        />
                      </Tooltip>
                    </div>
                    <SortableTableHeader
                      label="ユーザー"
                      sortKey="name"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      flex="1 1 280px"
                    />
                    <SortableTableHeader
                      label="ロール"
                      sortKey="role"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      flex="0 0 150px"
                    />
                    <SortableTableHeader
                      label="登録日"
                      sortKey="registeredDate"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      flex="0 0 130px"
                    />
                    <SortableTableHeader
                      label="最終ログイン"
                      sortKey="lastLogin"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      flex="0 0 150px"
                    />
                    <SortableTableHeader
                      label="ステータス"
                      sortKey="status"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      flex="0 0 120px"
                    />
                    <div className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ flex: "0 0 200px" }} role="columnheader">
                      アクション
                    </div>
                  </div>
                </div>
                <div
                  ref={parentRef}
                  className="divide-y divide-gray-200 bg-white"
                  style={{ height: "600px", overflow: "auto" }}
                  role="rowgroup"
                >
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: "100%",
                      position: "relative",
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const user = sortedData[virtualRow.index];
                      return (
                        <div
                          key={user.id}
                          className="hover:bg-gray-50"
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                            display: "flex",
                          }}
                          role="row"
                        >
                          <div className="whitespace-nowrap px-6 py-4" style={{ flex: "0 0 80px" }} role="cell">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(user.id)}
                              onChange={(e) => handleSelectUser(user.id, virtualRow.index, (e.nativeEvent as MouseEvent).shiftKey)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              aria-label={`ユーザー「${user.name}」を選択`}
                            />
                          </div>
                          <div className="whitespace-nowrap px-6 py-4" style={{ flex: "1 1 280px" }} role="cell">
                            <div className="flex items-center">
                              <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-200 flex items-center justify-center">
                                {user.avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={user.avatarUrl}
                                    alt={user.name}
                                    className="h-10 w-10 rounded-full"
                                  />
                                ) : (
                                  <span className="text-gray-500 text-xl" aria-hidden="true">
                                    👤
                                  </span>
                                )}
                              </div>
                              <div className="ml-4">
                                <div className="font-medium text-gray-900">{user.name}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                              </div>
                            </div>
                          </div>
                          <div
                            className="whitespace-nowrap px-6 py-4"
                            style={{ flex: "0 0 150px" }}
                            role="cell"
                          >
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getRoleBadge(
                                user.role
                              )}`}
                            >
                              {getRoleLabel(user.role)}
                            </span>
                            {user.vendorId && (
                              <div className="mt-1 text-xs text-gray-500">
                                店舗ID: {user.vendorId}
                              </div>
                            )}
                          </div>
                          <div
                            className="whitespace-nowrap px-6 py-4 text-sm text-gray-500"
                            style={{ flex: "0 0 130px" }}
                            role="cell"
                          >
                            {user.registeredDate}
                          </div>
                          <div
                            className="whitespace-nowrap px-6 py-4 text-sm text-gray-500"
                            style={{ flex: "0 0 150px" }}
                            role="cell"
                          >
                            {user.lastLogin}
                          </div>
                          <div
                            className="whitespace-nowrap px-6 py-4"
                            style={{ flex: "0 0 120px" }}
                            role="cell"
                          >
                            <StatusBadge
                              status={user.status === "active" ? "active" : "suspended"}
                              customLabel={user.status === "active" ? "アクティブ" : "停止中"}
                            />
                          </div>
                          <div
                            className="whitespace-nowrap px-6 py-4 text-right text-sm"
                            style={{ flex: "0 0 200px" }}
                            role="cell"
                          >
                            <Tooltip content="ロール・権限を変更" position="top">
                              <button
                                type="button"
                                onClick={() => handleOpenRoleChange(user)}
                                className="text-purple-600 hover:text-purple-900 mr-3"
                                aria-label={`${user.name}の権限を変更`}
                              >
                                権限変更
                              </button>
                            </Tooltip>
                            {user.status === "active" ? (
                              <Tooltip content="ユーザーを停止" position="top">
                                <button
                                  type="button"
                                  onClick={() => handleSuspendUser(user)}
                                  className="text-orange-600 hover:text-orange-900"
                                  aria-label={`${user.name}を停止`}
                                >
                                  停止
                                </button>
                              </Tooltip>
                            ) : (
                              <Tooltip content="ユーザーを復帰" position="top">
                                <button
                                  type="button"
                                  onClick={() => handleRestoreUser(user)}
                                  className="text-green-600 hover:text-green-900"
                                  aria-label={`${user.name}を復帰`}
                                >
                                  復帰
                                </button>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 権限変更モーダル */}
      {roleChangeUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => setRoleChangeUser(null)}
          role="dialog"
          aria-labelledby="role-change-title"
          aria-modal="true"
        >
          <div
            className="max-w-md w-full rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="role-change-title" className="text-xl font-bold text-gray-900 mb-4">
              権限変更
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">ユーザー</p>
                <p className="text-gray-900 font-medium">{roleChangeUser.name}</p>
                <p className="text-sm text-gray-500">{roleChangeUser.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">現在のロール</p>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getRoleBadge(
                    roleChangeUser.role
                  )}`}
                >
                  {getRoleLabel(roleChangeUser.role)}
                </span>
              </div>
              <div>
                <label
                  htmlFor="newRole"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  新しいロール
                </label>
                <select
                  id="newRole"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                >
                  <option value="general_user">一般ユーザー</option>
                  <option value="vendor">出店者</option>
                  <option value="moderator">モデレーター</option>
                  <option value="admin">管理者</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={handleRoleChange}
                className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                aria-label="ロールを変更"
              >
                変更する
              </button>
              <button
                type="button"
                onClick={() => setRoleChangeUser(null)}
                className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                aria-label="キャンセル"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ユーザー招待モーダル */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => setShowInviteModal(false)}
          role="dialog"
          aria-labelledby="invite-modal-title"
          aria-modal="true"
        >
          <div
            className="max-w-md w-full rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="invite-modal-title" className="text-xl font-bold text-gray-900 mb-4">
              ユーザーを招待
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && inviteEmail) {
                      handleInviteSubmit();
                    }
                  }}
                  placeholder="example@email.com"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700 mb-1">
                  ロール
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="general_user">一般ユーザー</option>
                  <option value="vendor">出店者</option>
                  <option value="moderator">モデレーター</option>
                </select>
              </div>
              <p className="text-xs text-gray-500">
                招待メールが送信されます。受信者はメール内のリンクからパスワードを設定してログインできます。
              </p>
            </div>
            <div className="mt-6 flex gap-2">
              <LoadingButton
                onClick={handleInviteSubmit}
                isLoading={inviteLoading}
                loadingText="送信中..."
                disabled={!inviteEmail}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                aria-label="招待メールを送信"
              >
                招待メールを送信
              </LoadingButton>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                aria-label="キャンセル"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
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
