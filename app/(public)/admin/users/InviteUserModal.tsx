import type { UserRole } from "@/lib/auth/types";
import { LoadingButton, Modal } from "@/components/admin";
import { Button } from "@/components/ui";

const FIELD = "w-full rounded-btn border border-line bg-white px-4 py-2 text-sm text-nicchyo-ink focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30";

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
    <Modal open onClose={onClose} title="ユーザーを招待" widthClassName="max-w-md">
      <div className="space-y-4">
        <div>
          <label htmlFor="invite-email" className="mb-1 block text-sm font-medium text-nicchyo-ink/70">
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
            className={FIELD}
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="invite-role" className="mb-1 block text-sm font-medium text-nicchyo-ink/70">
            ロール
          </label>
          <select id="invite-role" value={role} onChange={(e) => onRoleChange(e.target.value as UserRole)} className={FIELD}>
            <option value="general_user">一般ユーザー</option>
            <option value="vendor">出店者</option>
            <option value="moderator">モデレーター</option>
          </select>
        </div>
        <p className="text-xs text-nicchyo-ink/55">
          招待メールが送信されます。受信者はメール内のリンクからパスワードを設定してログインできます。
        </p>
      </div>
      <div className="mt-6 flex gap-2">
        <LoadingButton
          onClick={onSubmit}
          isLoading={isLoading}
          loadingText="送信中..."
          disabled={!email}
          className="flex-1 rounded-chip bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
          aria-label="招待メールを送信"
        >
          招待メールを送信
        </LoadingButton>
        <Button variant="quiet" className="flex-1" onClick={onClose} aria-label="キャンセル">
          キャンセル
        </Button>
      </div>
    </Modal>
  );
}
