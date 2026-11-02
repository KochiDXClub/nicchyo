import type { UserRole } from "@/lib/auth/types";
import { Modal } from "@/components/admin";
import { Badge, Button } from "@/components/ui";
import type { AdminUser } from "./useAdminUsers";
import { ROLE_BADGE_VARIANT, ROLE_LABEL } from "./roles";

const FIELD = "w-full rounded-btn border border-line bg-white px-4 py-2 text-sm text-nicchyo-ink focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30";

export function RoleChangeModal({
  user,
  newRole,
  onNewRoleChange,
  onSubmit,
  onClose,
}: {
  user: AdminUser;
  newRole: UserRole;
  onNewRoleChange: (role: UserRole) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} title="権限変更" widthClassName="max-w-md">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-nicchyo-ink/55">ユーザー</p>
          <p className="font-medium text-nicchyo-ink">{user.name}</p>
          <p className="text-sm text-nicchyo-ink/55">{user.email}</p>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-nicchyo-ink/55">現在のロール</p>
          <Badge variant={ROLE_BADGE_VARIANT[user.role]}>{ROLE_LABEL[user.role]}</Badge>
        </div>
        <div>
          <label htmlFor="newRole" className="mb-2 block text-sm font-medium text-nicchyo-ink/70">
            新しいロール
          </label>
          <select id="newRole" value={newRole} onChange={(e) => onNewRoleChange(e.target.value as UserRole)} className={FIELD}>
            <option value="general_user">一般ユーザー</option>
            <option value="vendor">出店者</option>
            <option value="moderator">モデレーター</option>
            <option value="admin">管理者</option>
          </select>
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <Button className="flex-1" onClick={onSubmit} aria-label="ロールを変更">
          変更する
        </Button>
        <Button variant="quiet" className="flex-1" onClick={onClose} aria-label="キャンセル">
          キャンセル
        </Button>
      </div>
    </Modal>
  );
}
