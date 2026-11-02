"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Printer } from "lucide-react";
import { Button, EmptyMessage } from "@/components/ui";
import InviteSummary from "@/app/vendor/members/components/InviteSummary";
import QrSheet from "../../components/QrSheet";
import { formatJaDateTime } from "@/lib/utils/date";
import CreatedInviteLink from "@/app/vendor/members/components/CreatedInviteLink";
import MaxUsesPicker from "@/app/vendor/members/components/MaxUsesPicker";
import PermissionPicker from "@/app/vendor/members/components/PermissionPicker";
import { showToast } from "@/lib/admin/toast";
import { createShopInvite, fetchShopInvites, revokeShopInvite, type AdminInvite, type ShopClaimRow } from "@/lib/admin/shopClaimsClient";
import { SHOP_INVITE_RULES, SHOP_PERMISSION_PRESETS, type ShopPermission } from "@/lib/vendor/shopPermissions";

/**
 * 店舗に家族やスタッフを入れる招待リンク（運営が作る）。店舗側の画面（出店者のアカウント）と同じ決まり:
 * 有効期限は7日、1本で入れるのは1〜5人。入った人はメンバーになり、付ける権限は作るときに決める。
 * リンクの中身は、作った直後の1回しか出せない（QRコードにして見せることもできる）。
 * 代表者がいない店舗には作れない（メンバーだけが残らないよう、先にQRで代表者を決める）。
 */
export function ShopInviteSection({ claim }: { claim: ShopClaimRow }) {
  const { vendorId } = claim;
  const hasOwner = claim.state === "claimed";
  const [invites, setInvites] = useState<AdminInvite[] | null>(null);
  const [maxUses, setMaxUses] = useState<number>(1);
  const [permissions, setPermissions] = useState<ShopPermission[]>([...SHOP_PERMISSION_PRESETS.helper.permissions]);
  const [created, setCreated] = useState<{ url: string; expiresAt: string; maxUses: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setInvites(await fetchShopInvites(vendorId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "招待リンクを読み込めませんでした");
    }
  }, [vendorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await createShopInvite(vendorId, { maxUses, permissions });
      setCreated({ url: result.url, expiresAt: result.expiresAt, maxUses });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "招待リンクを作れませんでした");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    setError(null);
    try {
      await revokeShopInvite(vendorId, inviteId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "招待リンクを取り消せませんでした");
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      showToast.success("リンクをコピーしました");
    } catch {
      showToast.error("コピーできませんでした。リンクを選んで、コピーしてください");
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-nicchyo-ink">メンバーの招待リンク</h3>
      <p className="text-[13px] text-nicchyo-ink/55">
        家族やスタッフがGoogleアカウントでお店に参加するためのリンクです。{SHOP_INVITE_RULES.expiresInDays}日間使えます。
      </p>

      {!hasOwner ? (
        <p className="rounded-btn bg-nicchyo-base p-3 text-sm text-nicchyo-ink/70">
          代表者がいる店舗でだけ作れます。先に、上のQRコードで代表者を決めてください。
        </p>
      ) : (
        <div className="space-y-3 rounded-card border border-line p-4">
          <MaxUsesPicker value={maxUses} onChange={setMaxUses} />
          <div>
            <p className="mb-1.5 text-xs font-semibold text-nicchyo-ink/55">入った人ができること</p>
            <PermissionPicker value={permissions} onChange={setPermissions} canToggle={() => true} idPrefix="admin-invite" disabled={busy} />
          </div>
          <Button size="sm" onClick={handleCreate} disabled={busy}>
            {busy ? "作っています…" : "招待リンクを作る"}
          </Button>

          {created && (
            <CreatedInviteLink url={created.url} expiresAt={created.expiresAt}>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" onClick={handleCopy}>
                  <Copy size={14} aria-hidden /> リンクをコピー
                </Button>
                <Button size="sm" onClick={() => window.print()}>
                  <Printer size={14} aria-hidden /> 印刷する
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCreated(null)}>閉じる</Button>
              </div>
              <QrSheet
                results={[{ vendorId, shopName: claim.shopName, status: "ok", url: created.url }]}
                description="スマホのカメラでこのQRコードを読み取り、Googleアカウントでログインすると、このお店のメンバーとして参加できます。"
                caption={`${formatJaDateTime(created.expiresAt)}まで・${created.maxUses}人まで`}
              />
              <p className="text-xs text-nicchyo-ink/70">リンクもQRコードも、いま見えている間しか表示できません。</p>
            </CreatedInviteLink>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-btn bg-status-critical-bg p-3 text-sm text-status-critical-fg ring-1 ring-status-critical-line">
          {error}
        </p>
      )}

      {invites === null ? null : invites.length === 0 ? (
        <EmptyMessage message="まだ招待リンクはありません" />
      ) : (
        <ul className="space-y-2">
          {invites.map((invite) => (
            <li key={invite.id} className="space-y-1.5 rounded-card border border-line p-3">
              <InviteSummary invite={invite}>
                {invite.state === "active" && (
                  <Button size="sm" variant="quiet" className="ml-auto" onClick={() => handleRevoke(invite.id)}>
                    取り消す
                  </Button>
                )}
              </InviteSummary>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
