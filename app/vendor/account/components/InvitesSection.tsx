"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { Button, EmptyMessage, Surface } from "@/components/ui";
import { canGrantPermissions } from "@/lib/vendor/memberRules";
import {
  SHOP_INVITE_RULES,
  SHOP_PERMISSION_PRESETS,
  type ShopMembership,
  type ShopPermission,
} from "@/lib/vendor/shopPermissions";
import { createInvite, fetchInvites, revokeInvite, type InviteView } from "../../_services/membersService";
import InviteSummary from "./InviteSummary";
import CreatedInviteLink from "./CreatedInviteLink";
import MaxUsesPicker from "./MaxUsesPicker";
import PermissionPicker from "./PermissionPicker";

/**
 * 招待リンクを作る・取り消す（メンバーの管理ができる人だけ）。
 * 有効期限は7日、1本のリンクで入れる人数は1〜5人。入った人にどんな権限をつけるかも、作るときに決める。
 * リンクの URL は、作った直後の1回しか出せない（サーバーにはハッシュしか残していない）。
 */
export default function InvitesSection({ membership, onChanged }: { membership: ShopMembership; onChanged: () => void }) {
  const [invites, setInvites] = useState<InviteView[] | null>(null);
  const [maxUses, setMaxUses] = useState<number>(1);
  const [permissions, setPermissions] = useState<ShopPermission[]>([...SHOP_PERMISSION_PRESETS.helper.permissions].filter((p) => canGrantPermissions(membership, [p])));
  const [created, setCreated] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setInvites(await fetchInvites());
    } catch (e) {
      setError(e instanceof Error ? e.message : "招待リンクを読み込めませんでした");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const result = await createInvite({ maxUses, permissions });
      setCreated({ url: result.url, expiresAt: result.expiresAt });
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "招待リンクを作れませんでした");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setError(null);
    try {
      await revokeInvite(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "招待リンクを取り消せませんでした");
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      setError("コピーできませんでした。リンクを長押しして、コピーしてください。");
    }
  };

  return (
    <section aria-labelledby="invites-heading" className="space-y-3">
      <h2 id="invites-heading" className="px-1 text-lg font-bold text-nicchyo-ink">
        家族やスタッフを招待する
      </h2>

      <Surface padding="md" className="space-y-4">
        <p className="text-sm leading-relaxed text-nicchyo-ink/70">
          リンクを送ると、受け取った人がGoogleアカウントでお店に参加できます。リンクは{SHOP_INVITE_RULES.expiresInDays}日間使えます。
        </p>

        <MaxUsesPicker value={maxUses} onChange={setMaxUses} />

        <div>
          <p className="mb-1.5 text-xs font-semibold text-nicchyo-ink/55">入った人ができること</p>
          <PermissionPicker
            value={permissions}
            onChange={setPermissions}
            canToggle={(permission) => canGrantPermissions(membership, [permission])}
            idPrefix="invite"
            disabled={busy}
          />
        </div>

        <Button size="lg" className="w-full" onClick={handleCreate} disabled={busy}>
          {busy ? "作っています…" : "招待リンクを作る"}
        </Button>

        {created && (
          <CreatedInviteLink url={created.url} expiresAt={created.expiresAt}>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={handleCopy}>
                <Copy size={14} aria-hidden /> {copied ? "コピーしました" : "リンクをコピー"}
              </Button>
            </div>
            <p className="text-xs text-nicchyo-ink/70">このリンクは、いま見えている間しか表示できません。LINEなどで送ってください。</p>
          </CreatedInviteLink>
        )}

        {error && (
          <p role="alert" className="rounded-btn bg-status-critical-bg p-3 text-sm text-status-critical-fg ring-1 ring-status-critical-line">
            {error}
          </p>
        )}
      </Surface>

      <div className="space-y-2">
        <h3 className="px-1 text-sm font-bold text-nicchyo-ink">作ったリンク</h3>
        {invites === null ? null : invites.length === 0 ? (
          <EmptyMessage message="まだ招待リンクはありません" />
        ) : (
          <ul className="space-y-2">
            {invites.map((invite) => (
              <li key={invite.id}>
                <Surface padding="sm" className="space-y-2">
                  <InviteSummary invite={invite} />
                  {invite.state === "active" && (
                    <Button size="sm" variant="quiet" onClick={() => handleRevoke(invite.id)}>
                      取り消す
                    </Button>
                  )}
                </Surface>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
