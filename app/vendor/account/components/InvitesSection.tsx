"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { Badge, Button, EmptyMessage, Surface } from "@/components/ui";
import { formatJaDateTime } from "@/lib/utils/date";
import { canGrantPermissions } from "@/lib/vendor/memberRules";
import {
  SHOP_INVITE_RULES,
  SHOP_PERMISSION_META,
  SHOP_PERMISSION_PRESETS,
  type ShopMembership,
  type ShopPermission,
} from "@/lib/vendor/shopPermissions";
import { createInvite, fetchInvites, revokeInvite, type InviteState, type InviteView } from "../../_services/membersService";
import PermissionPicker from "./PermissionPicker";

const STATE_LABEL: Record<InviteState, { text: string; variant: "amber" | "neutral" | "caution" }> = {
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
                className={`inline-flex h-10 min-w-10 items-center justify-center rounded-chip px-3 text-sm font-semibold transition ${
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
          <div className="space-y-2 rounded-btn bg-status-good-bg p-3 ring-1 ring-status-good-line">
            <p className="text-sm font-semibold text-status-good-fg">リンクができました（{formatJaDateTime(created.expiresAt)}まで）</p>
            <input
              readOnly
              value={created.url}
              aria-label="招待リンク"
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-btn bg-white px-3 py-2 text-xs text-nicchyo-ink ring-1 ring-line"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={handleCopy}>
                <Copy size={14} aria-hidden /> {copied ? "コピーしました" : "リンクをコピー"}
              </Button>
            </div>
            <p className="text-xs text-nicchyo-ink/70">このリンクは、いま見えている間しか表示できません。LINEなどで送ってください。</p>
          </div>
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
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={STATE_LABEL[invite.state].variant}>{STATE_LABEL[invite.state].text}</Badge>
                    <span className="text-sm text-nicchyo-ink">
                      {invite.usedCount}/{invite.maxUses}人が参加
                    </span>
                    <span className="text-xs text-nicchyo-ink/55">{formatJaDateTime(invite.expiresAt)}まで</span>
                  </div>
                  <p className="text-xs text-nicchyo-ink/70">
                    {invite.permissions.length > 0
                      ? invite.permissions.map((p) => SHOP_PERMISSION_META[p].label).join("・")
                      : "お店の情報を見るだけ"}
                  </p>
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
