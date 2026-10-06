"use client";

import { LogOut } from "lucide-react";
import { Badge, Button, Surface } from "@/components/ui";
import type { User } from "@/lib/auth/types";
import { SHOP_PERMISSION_META, type ShopMembership } from "@/lib/vendor/shopPermissions";

/**
 * 自分のアカウント（ログイン中のGoogleアカウント）と、お店での立場・できること。
 * 名前と写真は ProfileSection で変える。メールアドレスはGoogle側のもので、ここでは変えない。
 */
export default function AccountSummary({
  user,
  membership,
  onLogout,
  loggingOut,
}: {
  user: User;
  /** お店での立場と権限（最新のもの。無ければ未所属） */
  membership: ShopMembership | undefined;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  return (
    <section aria-labelledby="account-heading" className="space-y-3">
      <h2 id="account-heading" className="px-1 text-lg font-bold text-nicchyo-ink">
        あなたのアカウント
      </h2>
      <Surface padding="md" className="space-y-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-bold text-nicchyo-ink">{user.name}</p>
            {membership?.role === "owner" ? <Badge variant="amber">代表者</Badge> : <Badge>メンバー</Badge>}
          </div>
          {user.email && <p className="break-all text-sm text-nicchyo-ink/70">{user.email}</p>}
          <p className="text-xs text-nicchyo-ink/55">
            {user.provider === "google" ? "Googleアカウントでログインしています。メールアドレスは、Googleの設定で変えられます。" : "ログイン中のアカウントです。"}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-nicchyo-ink/55">お店でできること</p>
          {membership?.role === "owner" ? (
            <p className="mt-1 text-sm text-nicchyo-ink/70">代表者なので、すべての操作ができます。</p>
          ) : membership && membership.permissions.length > 0 ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {membership.permissions.map((permission) => (
                <li key={permission}>
                  <Badge variant="info">{SHOP_PERMISSION_META[permission].label}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-nicchyo-ink/70">お店の情報を見ることができます（編集はできません）。</p>
          )}
        </div>

        <Button variant="quiet" size="sm" onClick={onLogout} disabled={loggingOut}>
          <LogOut size={14} aria-hidden /> {loggingOut ? "ログアウトしています…" : "ログアウト"}
        </Button>
      </Surface>
    </section>
  );
}
