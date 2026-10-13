"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Badge, Button, Surface } from "@/components/ui";
import { canGrantPermissions, canManageMember, canTransferOwnership, type MemberRef } from "@/lib/vendor/memberRules";
import { hasShopPermission, SHOP_PERMISSION_KEYS, SHOP_PERMISSION_META, type ShopPermission } from "@/lib/vendor/shopPermissions";
import type { MembersResponse, ShopMemberView } from "../../_services/membersService";
import MemberSheet from "./MemberSheet";

function toRef(member: ShopMemberView): MemberRef {
  return { userId: member.userId, role: member.role, permissions: member.permissions };
}

/** 「2026年10月3日に参加」の形。時刻までは要らない */
function joinedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日に参加`;
}

/**
 * お店のメンバー一覧。メンバーなら誰でも見られる。
 * 権限の変更・外す・代表者の引き継ぎは、規則（lib/vendor/memberRules.ts）で許される行にだけ「設定を変える」が出て、
 * 押すと下からシート（MemberSheet）が上がる。一覧の行は短く保ち、スマホでも指で押しやすくする。
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
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  if (!me) return null;
  const meRef = toRef(me);
  const myMembership = { role: me.role, permissions: me.permissions };
  const canToggle = (permission: ShopPermission) => canGrantPermissions(myMembership, [permission]);
  const canManage = hasShopPermission(myMembership, "members_manage");
  const open = data.members.find((member) => member.userId === openUserId) ?? null;

  return (
    <section aria-labelledby="members-heading" className="space-y-3">
      <div className="px-1">
        <h2 id="members-heading" className="text-lg font-bold text-nicchyo-ink">
          お店のメンバー（{data.members.length}人）
        </h2>
        {!canManage && (
          <p className="mt-1 text-sm leading-relaxed text-nicchyo-ink/70">
            メンバーを増やしたり、できることを変えたりしたいときは、代表者か副代表に頼んでください。
          </p>
        )}
      </div>

      <ul className="space-y-3">
        {data.members.map((member) => {
          const ref = toRef(member);
          const canEdit = canManageMember(meRef, ref);
          const canTransfer = canTransferOwnership(meRef, ref);
          const isDeputy = member.role === "member" && member.permissions.includes("members_manage");
          return (
            <li key={member.userId}>
              <Surface padding="sm" className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-nicchyo-primary text-[15px] font-bold text-white"
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="break-all text-[15px] font-bold text-nicchyo-ink">{member.name}</span>
                      {member.role === "owner" && <Badge variant="amber">代表者</Badge>}
                      {isDeputy && <Badge variant="info">副代表</Badge>}
                      {member.isMe && <Badge>あなた</Badge>}
                    </div>
                    {member.email && <p className="break-all text-xs text-nicchyo-ink/55">{member.email}</p>}

                    {member.role === "owner" ? (
                      <p className="text-xs text-nicchyo-ink/70">すべての操作ができます。</p>
                    ) : member.permissions.length === SHOP_PERMISSION_KEYS.length ? (
                      // 全部ついているときに札を7つ並べると、スマホで行が長くなりすぎる
                      <p className="text-xs text-nicchyo-ink/70">代表者以外のほぼすべての操作ができます。</p>
                    ) : member.permissions.length > 0 ? (
                      <ul className="flex flex-wrap gap-1.5" aria-label={`${member.name}さんができること`}>
                        {member.permissions.map((permission) => (
                          <li key={permission}>
                            <Badge variant="neutral">{SHOP_PERMISSION_META[permission].label}</Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-nicchyo-ink/70">お店の情報を見ることができます（編集はできません）。</p>
                    )}
                    <p className="text-xs text-nicchyo-ink/55">{joinedLabel(member.joinedAt)}</p>
                  </div>
                </div>

                {(canEdit || canTransfer) && (
                  <Button
                    variant="secondary"
                    className="w-full shrink-0 sm:w-auto"
                    aria-label={`${member.name}さんの設定を変える`}
                    onClick={() => setOpenUserId(member.userId)}
                  >
                    設定を変える
                  </Button>
                )}
              </Surface>
            </li>
          );
        })}
      </ul>

      <AnimatePresence>
        {open && (
          <MemberSheet
            key={open.userId}
            member={open}
            canEdit={canManageMember(meRef, toRef(open))}
            canTransfer={canTransferOwnership(meRef, toRef(open))}
            canToggle={canToggle}
            onClose={() => setOpenUserId(null)}
            onChanged={onChanged}
            onTransferred={onTransferred}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
