import type { UserRole } from "@/lib/auth/types";
import type { AdminUser } from "./useAdminUsers";

export function RoleChangeModal({
  user,
  newRole,
  onNewRoleChange,
  getRoleBadge,
  getRoleLabel,
  onSubmit,
  onClose,
}: {
  user: AdminUser;
  newRole: UserRole;
  onNewRoleChange: (role: UserRole) => void;
  getRoleBadge: (role: UserRole) => string | undefined;
  getRoleLabel: (role: UserRole) => string | undefined;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
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
            <p className="text-gray-900 font-medium">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">現在のロール</p>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getRoleBadge(
                user.role
              )}`}
            >
              {getRoleLabel(user.role)}
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
              onChange={(e) => onNewRoleChange(e.target.value as UserRole)}
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
            onClick={onSubmit}
            className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
            aria-label="ロールを変更"
          >
            変更する
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
            aria-label="キャンセル"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
