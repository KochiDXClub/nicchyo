import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UserRole } from "@/lib/auth/types";
import { excelText } from "@/lib/admin/exportUtils";
import { showToast } from "@/lib/admin/toast";
import { useDebounce } from "use-debounce";
import { useSortableData } from "@/components/admin/desktop/SortableTableHeader";
import { useRowSelection } from "@/components/admin/useRowSelection";
import { useBulkAction } from "@/components/admin/useBulkAction";
import { useListExport } from "@/components/admin/useListExport";
import { ROLE_LABEL } from "./roles";

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
  const [roleChangeUser, setRoleChangeUser] = useState<AdminUser | null>(null);
  const [newRole, setNewRole] = useState<UserRole>("general_user");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  const rowIds = useMemo(() => sortedData.map((u) => u.id), [sortedData]);
  const selection = useRowSelection(rowIds);

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

  // 一括操作（確認 → API → 通知 → 読み直しは共通）
  const { bulkLoading, runBulk } = useBulkAction({
    endpoint: "/api/admin/users/bulk",
    unit: "人",
    subject: "ユーザー",
    deleteWarning: "この操作は取り消せません。",
    onDone: reloadUsers,
  });

  const handleBulk = useCallback(
    async (action: "restore" | "suspend" | "delete", label: string) => {
      if (await runBulk(action, selection.selectedIds, label)) selection.clear();
    },
    [runBulk, selection]
  );

  // エクスポート
  const { isExporting, exportCsv, exportJson } = useListExport({
    prefix: "users",
    rows: filteredUsers,
    toCsvRow: (user: AdminUser) => ({
      ID: user.id,
      名前: user.name,
      メールアドレス: user.email,
      ロール: ROLE_LABEL[user.role],
      店舗ID: user.vendorId?.toString() || "",
      登録日: excelText(user.registeredDate),
      最終ログイン: excelText(user.lastLogin),
      ステータス: user.status === "active" ? "アクティブ" : "停止中",
    }),
  });

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
        `${roleChangeUser.name}のロールを「${ROLE_LABEL[roleChangeUser.role]}」から「${ROLE_LABEL[newRole]}」に変更しますか？`
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
      showToast.success(`${roleChangeUser.name}のロールを「${ROLE_LABEL[newRole]}」に変更しました`);
      setRoleChangeUser(null);
      reloadUsers();
    } catch {
      showToast.error("ロール変更に失敗しました");
    }
  }, [roleChangeUser, newRole, reloadUsers]);

  return {
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    selection,
    roleChangeUser,
    setRoleChangeUser,
    newRole,
    setNewRole,
    isExporting,
    bulkLoading,
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
    handleBulk,
    exportCsv,
    exportJson,
    handleSuspendUser,
    handleRestoreUser,
    handleCreateUser,
    handleInviteSubmit,
    handleOpenRoleChange,
    handleRoleChange,
  };
}
