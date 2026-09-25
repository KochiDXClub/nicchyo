import type { RefObject } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import type { UserRole } from "@/lib/auth/types";
import { StatusBadge } from "@/components/admin";
import { SortableTableHeader, type SortDirection } from "@/components/admin/desktop/SortableTableHeader";
import { Tooltip } from "@/components/admin/desktop/Tooltip";
import type { AdminUser } from "./useAdminUsers";

export function UserTable({
  sortedData,
  sortKey,
  sortDirection,
  onSort,
  selectedUserIds,
  filteredUsersCount,
  onSelectAll,
  onSelectUser,
  parentRef,
  rowVirtualizer,
  getRoleBadge,
  getRoleLabel,
  onOpenRoleChange,
  onSuspendUser,
  onRestoreUser,
}: {
  sortedData: AdminUser[];
  sortKey: string | null;
  sortDirection: SortDirection;
  onSort: (key: string) => void;
  selectedUserIds: string[];
  filteredUsersCount: number;
  onSelectAll: () => void;
  onSelectUser: (userId: string, index: number, shiftKey: boolean) => void;
  parentRef: RefObject<HTMLDivElement>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  getRoleBadge: (role: UserRole) => string | undefined;
  getRoleLabel: (role: UserRole) => string | undefined;
  onOpenRoleChange: (user: AdminUser) => void;
  onSuspendUser: (user: AdminUser) => void;
  onRestoreUser: (user: AdminUser) => void;
}) {
  return (
    <div className="rounded-lg bg-white shadow">
      <div className="overflow-x-auto">
        <div className="w-full" role="table">
          <div className="bg-gray-50" role="rowgroup">
            <div className="flex" role="row">
              <div className="px-6 py-3 text-left" style={{ flex: "0 0 80px" }} role="columnheader">
                <Tooltip content="すべてのユーザーを選択/解除 (Ctrl+A)" position="top">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.length === filteredUsersCount && filteredUsersCount > 0}
                    onChange={onSelectAll}
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
                onSort={onSort}
                flex="1 1 280px"
              />
              <SortableTableHeader
                label="ロール"
                sortKey="role"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={onSort}
                flex="0 0 150px"
              />
              <SortableTableHeader
                label="登録日"
                sortKey="registeredDate"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={onSort}
                flex="0 0 130px"
              />
              <SortableTableHeader
                label="最終ログイン"
                sortKey="lastLogin"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={onSort}
                flex="0 0 150px"
              />
              <SortableTableHeader
                label="ステータス"
                sortKey="status"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={onSort}
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
                        onChange={(e) => onSelectUser(user.id, virtualRow.index, (e.nativeEvent as MouseEvent).shiftKey)}
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
                          onClick={() => onOpenRoleChange(user)}
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
                            onClick={() => onSuspendUser(user)}
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
                            onClick={() => onRestoreUser(user)}
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
  );
}
