import type { UserRole } from "@/lib/auth/types";
import { LoadingButton } from "@/components/admin";

export function InviteUserModal({
  email,
  onEmailChange,
  role,
  onRoleChange,
  isLoading,
  onSubmit,
  onClose,
}: {
  email: string;
  onEmailChange: (value: string) => void;
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  isLoading: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
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
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && email) {
                  onSubmit();
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
              value={role}
              onChange={(e) => onRoleChange(e.target.value as UserRole)}
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
            onClick={onSubmit}
            isLoading={isLoading}
            loadingText="送信中..."
            disabled={!email}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            aria-label="招待メールを送信"
          >
            招待メールを送信
          </LoadingButton>
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
