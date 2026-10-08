"use client";

import { useState } from "react";
import { Badge, Button, Surface } from "@/components/ui";
import { canGrantPermissions, canManageMember, canTransferOwnership, type MemberRef } from "@/lib/vendor/memberRules";
import { SHOP_PERMISSION_META, type ShopPermission } from "@/lib/vendor/shopPermissions";
import {
  removeMember,
  transferOwnership,
  updateMemberPermissions,
  type MembersResponse,
  type ShopMemberView,
} from "../../_services/membersService";
import PermissionPicker from "./PermissionPicker";

type Action = { kind: "edit" | "remove" | "transfer"; userId: string };

function toRef(member: ShopMemberView): MemberRef {
  return { userId: member.userId, role: member.role, permissions: member.permissions };
}

/**
 * お店のメンバー一覧。メンバーなら誰でも見られる。
 * 権限の変更・外す・代表者の引き継ぎは、規則（lib/vendor/memberRules.ts）で許される行にだけボタンが出る
 * （API も同じ規則で断るので、ここは見せ方）。取り返しのつかない操作は、その行の中で確かめてから行う。
 */
export default function MembersSection({
  data,
  onChanged,
  onTransferred,
}: {
  data: MembersResponse;
  onChanged: () => void;
  /** 代表者を引き継いだあと（自分の権限が変わるので、画面を読み直してもらう） */
  onTransferred: () => void;
}) {
  const me = data.members.find((member) => member.isMe);
  const [action, setAction] = useState<Action | null>(null);
  const [draft, setDraft] = useState<ShopPermission[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!me) return null;
  const meRef = toRef(me);
  const myMembership = { role: me.role, permissions: me.permissions };
  const canToggle = (permission: ShopPermission) => canGrantPermissions(myMembership, [permission]);

  const run = async (task: () => Promise<void>, after: () => void = onChanged) => {
    setBusy(true);
    setError(null);
    try {
      await task();
      setAction(null);
      after();
    } catch (e) {
      setError(e instanceof Error ? e.message : "うまくいきませんでした");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (member: ShopMemberView) => {
    setError(null);
    setDraft(member.permissions);
    setAction({ kind: "edit", userId: member.userId });
  };

  return (
    <section aria-labelledby="members-heading" className="space-y-3">
      <h2 id="members-heading" className="px-1 text-lg font-bold text-nicchyo-ink">
        お店のメンバー
      </h2>
      <ul className="space-y-3">
        {data.members.map((member) => {
          const ref = toRef(member);
          const active = action?.userId === member.userId ? action.kind : null;
          const canEdit = canManageMember(meRef, ref);
          const canTransfer = canTransferOwnership(meRef, ref);
          return (
            <li key={member.userId}>
              <Surface padding="sm" className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-bold text-nicchyo-ink">{member.name}</span>
                  {member.role === "owner" && <Badge variant="amber">代表者</Badge>}
                  {member.isMe && <Badge>あなた</Badge>}
                </div>
                {member.email && <p className="break-all text-xs text-nicchyo-ink/55">{member.email}</p>}

                {member.role === "owner" ? (
                  <p className="text-xs text-nicchyo-ink/70">すべての操作ができます。</p>
                ) : member.permissions.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {member.permissions.map((permission) => (
                      <li key={permission}>
                        <Badge variant="info">{SHOP_PERMISSION_META[permission].label}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-nicchyo-ink/70">お店の情報を見ることができます（編集はできません）。</p>
                )}

                {active === "edit" && (
                  <div className="space-y-3 border-t border-line pt-3">
                    <PermissionPicker value={draft} onChange={setDraft} canToggle={canToggle} idPrefix={`edit-${member.userId}`} disabled={busy} />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={busy} onClick={() => run(() => updateMemberPermissions(member.userId, draft))}>
                        {busy ? "保存しています…" : "保存する"}
                      </Button>
                      <Button size="sm" variant="quiet" disabled={busy} onClick={() => setAction(null)}>
                        やめる
                      </Button>
                    </div>
                  </div>
                )}

                {active === "remove" && (
                  <div className="space-y-2 rounded-btn bg-status-critical-bg p-3 ring-1 ring-status-critical-line">
                    <p className="text-sm text-status-critical-fg">
                      {member.name}さんを、お店から外します。この人は、お店の情報を見たり編集したりできなくなります。
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={busy} onClick={() => run(() => removeMember(member.userId))}>
                        {busy ? "外しています…" : "外す"}
                      </Button>
                      <Button size="sm" variant="quiet" disabled={busy} onClick={() => setAction(null)}>
                        やめる
                      </Button>
                    </div>
                  </div>
                )}

                {active === "transfer" && (
                  <div className="space-y-2 rounded-btn bg-status-warning-bg p-3 ring-1 ring-status-warning-line">
                    <p className="text-sm text-status-warning-fg">
                      代表者を{member.name}さんに引き継ぎます。あなたは、代表者以外のほぼすべての操作ができる「副代表」として残ります。
                      代表者を戻したいときは、{member.name}さんに引き継ぎ直してもらいます。
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={busy} onClick={() => run(() => transferOwnership(member.userId), onTransferred)}>
                        {busy ? "引き継いでいます…" : "代表者を引き継ぐ"}
                      </Button>
                      <Button size="sm" variant="quiet" disabled={busy} onClick={() => setAction(null)}>
                        やめる
                      </Button>
                    </div>
                  </div>
                )}

                {!active && (canEdit || canTransfer) && (
                  <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                    {canEdit && (
                      <Button size="sm" variant="secondary" onClick={() => startEdit(member)}>
                        できることを変える
                      </Button>
                    )}
                    {canEdit && (
                      <Button size="sm" variant="quiet" onClick={() => setAction({ kind: "remove", userId: member.userId })}>
                        お店から外す
                      </Button>
                    )}
                    {canTransfer && (
                      <Button size="sm" variant="quiet" onClick={() => setAction({ kind: "transfer", userId: member.userId })}>
                        代表者を引き継ぐ
                      </Button>
                    )}
                  </div>
                )}
              </Surface>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="rounded-btn bg-status-critical-bg p-3 text-sm text-status-critical-fg ring-1 ring-status-critical-line">
          {error}
        </p>
      )}
    </section>
  );
}
