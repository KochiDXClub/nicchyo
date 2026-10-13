"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Badge, Button, EmptyMessage } from "@/components/ui";
import PermissionPicker from "@/app/vendor/account/components/PermissionPicker";
import { showToast } from "@/lib/admin/toast";
import { createShopInvite, fetchShopInvites, revokeShopInvite, type AdminInvite, type ShopClaimRow } from "@/lib/admin/shopClaimsClient";
import { formatJaDateTime } from "@/lib/utils/date";
import { SHOP_INVITE_RULES, SHOP_PERMISSION_META, SHOP_PERMISSION_PRESETS, type ShopPermission } from "@/lib/vendor/shopPermissions";

const STATE_LABEL: Record<AdminInvite["state"], { text: string; variant: "amber" | "neutral" | "caution" }> = {
  active: { text: "使えます", variant: "amber" },
  expired: { text: "期限切れ", variant: "neutral" },
  full: { text: "人数に達した", variant: "neutral" },
  revoked: { text: "取り消し済み", variant: "caution" },
};

const MAX_USES_OPTIONS = Array.from(
  { length: SHOP_INVITE_RULES.maxUses - SHOP_INVITE_RULES.minUses + 1 },
  (_, i) => SHOP_INVITE_RULES.minUses + i,
);

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
  const [created, setCreated] = useState<{ url: string; expiresAt: string } | null>(null);
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
      setCreated({ url: result.url, expiresAt: result.expiresAt });
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
          <div>
            <p className="text-xs font-semibold text-nicchyo-ink/55">このリンクで入れる人数</p>
            <div role="radiogroup" aria-label="入れる人数" className="mt-1.5 flex flex-wrap gap-1.5">
              {MAX_USES_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={maxUses === n}
                  onClick={() => setMaxUses(n)}
                  className={`inline-flex h-9 min-w-9 items-center justify-center rounded-chip px-3 text-sm font-semibold transition ${
                    maxUses === n ? "bg-amber-600 text-white shadow-sm" : "border border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
                  }`}
                >
                  {n}人
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-nicchyo-ink/55">入った人ができること</p>
            <PermissionPicker value={permissions} onChange={setPermissions} canToggle={() => true} idPrefix="admin-invite" disabled={busy} />
          </div>
          <Button size="sm" onClick={handleCreate} disabled={busy}>
            {busy ? "作っています…" : "招待リンクを作る"}
          </Button>

          {created && (
            <div className="space-y-2 rounded-btn bg-status-good-bg p-3 ring-1 ring-status-good-line">
              <p className="text-sm font-semibold text-status-good-fg">リンクができました（{formatJaDateTime(created.expiresAt)}まで）</p>
              <input
                readOnly
                value={created.url}
                aria-label="招待リンク"
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded-btn bg-white px-3 py-2 text-xs text-nicchyo-ink ring-1 ring-line"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" onClick={handleCopy}>
                  <Copy size={14} aria-hidden /> リンクをコピー
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCreated(null)}>閉じる</Button>
              </div>
              <div className="flex items-center gap-3">
                <QRCodeSVG value={created.url} size={128} level="M" marginSize={2} title="招待リンクのQRコード" />
                <p className="text-xs text-nicchyo-ink/70">
                  その場で読み取ってもらうときは、このQRコードを見せてください。リンクもQRコードも、いま見えている間しか表示できません。
                </p>
              </div>
            </div>
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
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={STATE_LABEL[invite.state].variant}>{STATE_LABEL[invite.state].text}</Badge>
                <span className="text-sm text-nicchyo-ink">
                  {invite.usedCount}/{invite.maxUses}人が参加
                </span>
                <span className="text-xs text-nicchyo-ink/55">{formatJaDateTime(invite.expiresAt)}まで</span>
                {invite.state === "active" && (
                  <Button size="sm" variant="quiet" className="ml-auto" onClick={() => handleRevoke(invite.id)}>
                    取り消す
                  </Button>
                )}
              </div>
              <p className="text-xs text-nicchyo-ink/70">
                {invite.permissions.length > 0
                  ? invite.permissions.map((p) => SHOP_PERMISSION_META[p].label).join("・")
                  : "お店の情報を見るだけ"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
