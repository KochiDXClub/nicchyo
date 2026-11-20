"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Send } from "lucide-react";
import { Button, EmptyMessage, Surface } from "@/components/ui";
import { formatJaDateTime } from "@/lib/utils/date";
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
 * 端末の共有（LINE などへ送る）を出すか。指で触る端末（スマホ・タブレット）で、共有が使えるときだけ。
 * PC の Chrome / Edge / Safari にも共有はあるが、OS の共有パネルが開くだけで LINE は出ないことが多いので、コピーだけにする
 */
function canShare(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  return typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

/**
 * 招待リンクを作る・取り消す（メンバーの管理ができる人だけ）。
 * 有効期限は7日、1本のリンクで入れる人数は1〜5人。入った人にどんな権限をつけるかも、作るときに決める。
 * リンクの URL は、作った直後の1回しか出せない（サーバーにはハッシュしか残していない）。
 * スマホでは、できたリンクをそのまま LINE などへ送れる（端末の共有）。
 */
export default function InvitesSection({
  membership,
  inviterName,
  onChanged,
}: {
  membership: ShopMembership;
  /** 共有で送る文に入れる、送る人の名前（受け取った人が、誰からの招待か分かるように） */
  inviterName: string;
  onChanged: () => void;
}) {
  const [invites, setInvites] = useState<InviteView[] | null>(null);
  const [maxUses, setMaxUses] = useState<number>(1);
  const [permissions, setPermissions] = useState<ShopPermission[]>([...SHOP_PERMISSION_PRESETS.helper.permissions].filter((p) => canGrantPermissions(membership, [p])));
  const [created, setCreated] = useState<{ id: string; url: string; expiresAt: string; share: boolean } | null>(null);
  const createdRef = useRef<HTMLParagraphElement>(null);
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

  useEffect(() => {
    createdRef.current?.focus({ preventScroll: true });
  }, [created]);

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const result = await createInvite({ maxUses, permissions });
      // 共有を出すかは、作ったときに一度だけ決める（描くたびに変わらないように）
      setCreated({ id: result.id, url: result.url, expiresAt: result.expiresAt, share: canShare() });
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
      if (created?.id === id) setCreated(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "招待リンクを取り消せませんでした");
    }
  };

  const handleShare = async () => {
    if (!created) return;
    try {
      await navigator.share({
        title: "お店への招待",
        text: `${inviterName}さんから、日曜市のお店の出店者ページ（nicchyo）への招待です。${formatJaDateTime(created.expiresAt)}までにこのリンクを開いて、Googleアカウントで参加してください。`,
        url: created.url,
      });
    } catch (e) {
      // 共有の画面を閉じただけ（AbortError）のときは何も出さない。古い Safari の DOMException は Error を継承しないので、名前だけで見る
      if ((e as { name?: unknown } | null)?.name === "AbortError") return;
      setError("送れませんでした。「リンクをコピー」を押して、LINEなどに貼り付けてください。");
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
        {!created && (
          <>
            <p className="text-sm leading-relaxed text-nicchyo-ink/70">
              Googleアカウントで参加できます。リンクは{SHOP_INVITE_RULES.expiresInDays}日間使えます。
            </p>

            <MaxUsesPicker value={maxUses} onChange={setMaxUses} />

            <div>
              <p className="mb-1.5 text-sm font-bold text-nicchyo-ink">入った人ができること</p>
              <PermissionPicker
                compact
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
          </>
        )}

        {created && (
          <CreatedInviteLink url={created.url} expiresAt={created.expiresAt} messageRef={createdRef}>
            <div className="flex flex-col gap-2 sm:flex-row">
              {created.share && (
                <Button className="sm:flex-1" onClick={handleShare}>
                  <Send size={16} aria-hidden /> LINEなどで送る
                </Button>
              )}
              <Button variant={created.share ? "secondary" : "primary"} className="sm:flex-1" onClick={handleCopy}>
                <Copy size={16} aria-hidden /> {copied ? "コピーしました" : "リンクをコピー"}
              </Button>
            </div>
            <p className="text-xs text-nicchyo-ink/70">メンバー管理を閉じる前に、リンクを送るかコピーしてください。</p>
            <Button variant="quiet" onClick={() => { setCopied(false); setCreated(null); }}>もう1本作る</Button>
          </CreatedInviteLink>
        )}

        {error && (
          <p role="alert" className="rounded-btn bg-status-critical-bg p-3 text-sm text-status-critical-fg ring-1 ring-status-critical-line">
            {error}
          </p>
        )}
      </Surface>

      <details className="rounded-card border border-line bg-white px-4">
        <summary className="cursor-pointer py-3 text-sm font-bold text-nicchyo-ink">作ったリンク{invites && `（${invites.length}件）`}</summary>
        <div className="pb-3">
          {invites === null ? null : invites.length === 0 ? (
            <EmptyMessage message="まだ招待リンクはありません" />
          ) : (
            <ul className="space-y-2">
              {invites.map((invite) => (
                <li key={invite.id}>
                  <Surface padding="sm" className="space-y-2">
                    <InviteSummary invite={invite} />
                    {invite.state === "active" && (
                      <Button variant="quiet" onClick={() => handleRevoke(invite.id)}>
                        このリンクを取り消す
                        {/* 同じ名前のボタンが並ぶので、読み上げではどのリンクかを足す */}
                        <span className="sr-only">（{formatJaDateTime(invite.expiresAt)}まで）</span>
                      </Button>
                    )}
                  </Surface>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </section>
  );
}
