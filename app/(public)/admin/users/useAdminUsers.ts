import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UserRole } from "@/lib/auth/types";
import { exportToCSV, exportToJSON, formatDateForFilename, excelText } from "@/lib/admin/exportUtils";
import { showToast } from "@/lib/admin/toast";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDebounce } from "use-debounce";
import { useSortableData } from "@/components/admin/desktop/SortableTableHeader";

export interface AdminUser {
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

/**
 * ユーザー管理画面（/admin/users）の状態一式。
 *
 * 取得・フィルタ・ソート・選択・一括操作・エクスポート・権限変更・招待まで、
 * この画面が持つ状態と操作をすべてここに集約する。画面（page.tsx）側は
 * これを呼び、返ってきた値をそのまま表示に使うだけにする。
 */
export function useAdminUsers({ isAdmin }: { isAdmin: boolean }) {
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
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("general_user");
  const [inviteLoading, setInviteLoading] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAdmin) {
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
  }, [isAdmin]);

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
  const parentRef = useRef<HTMLDivElement>(null);
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
        登録日: excelText(user.registeredDate),
        最終ログイン: excelText(user.lastLogin),
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

  return {
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    selectedUserIds,
    setSelectedUserIds,
    roleChangeUser,
    setRoleChangeUser,
    newRole,
    setNewRole,
    isExporting,
    bulkLoading,
    users,
    isLoadingUsers,
    loadError,
    showInviteModal,
    setShowInviteModal,
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    inviteLoading,
    searchInputRef,
    filteredUsers,
    sortedData,
    sortKey,
    sortDirection,
    handleSort,
    stats,
    parentRef,
    rowVirtualizer,
    getRoleBadge,
    getRoleLabel,
    handleSelectAll,
    handleSelectUser,
    reloadUsers,
    handleBulkActivate,
    handleBulkSuspend,
    handleBulkDelete,
    handleExportCSV,
    handleExportJSON,
    handleSuspendUser,
    handleRestoreUser,
    handleCreateUser,
    handleInviteSubmit,
    handleOpenRoleChange,
    handleRoleChange,
  };
}
