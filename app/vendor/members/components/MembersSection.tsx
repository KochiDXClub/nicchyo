"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Badge, Button, Surface } from "@/components/ui";
import { formatJaDate } from "@/lib/utils/date";
import { canGrantPermissions, canManageMember, canTransferOwnership, type MemberRef } from "@/lib/vendor/memberRules";
import { hasShopPermission, SHOP_PERMISSION_KEYS, SHOP_PERMISSION_META, type ShopPermission } from "@/lib/vendor/shopPermissions";
import type { MembersResponse, ShopMemberView } from "../../_services/membersService";
import MemberSheet, { type MemberChange } from "./MemberSheet";

function toRef(member: ShopMemberView): MemberRef {
  return { userId: member.userId, role: member.role, permissions: member.permissions };
}

/**
 * お店のメンバー一覧。メンバーなら誰でも見られる。
 * 権限の変更・外す・代表者の引き継ぎは、規則（lib/vendor/memberRules.ts）で許される行にだけ「設定を変える」が出て、
 * 押すと下からシート（MemberSheet）が上がる。一覧の行は短く保ち、スマホでも指で押しやすくする。
 * 変えた・外したあとは、見出しの下に結果を出す（読み上げにも届く）。外したときは、押したボタンが行ごと消えるので、
 * フォーカスを見出しへ移す。
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
  const [notice, setNotice] = useState<string | null>(null);
  // 外したメンバー。読み直した一覧から消えたら、見出しへフォーカスを移す
  const [removedUserId, setRemovedUserId] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!removedUserId || data.members.some((member) => member.userId === removedUserId)) return;
    headingRef.current?.focus();
    setRemovedUserId(null);
  }, [data, removedUserId]);

  if (!me) return null;
  const meRef = toRef(me);
  const myMembership = { role: me.role, permissions: me.permissions };
  const canToggle = (permission: ShopPermission) => canGrantPermissions(myMembership, [permission]);
  const canManage = hasShopPermission(myMembership, "members_manage");
  const open = data.members.find((member) => member.userId === openUserId) ?? null;

  const openSheet = (userId: string) => {
    setNotice(null);
    setOpenUserId(userId);
  };

  const handleChanged = (userId: string, change: MemberChange) => {
    setNotice(change.message);
    if (change.kind === "remove") setRemovedUserId(userId);
    onChanged();
  };

  return (
    <section aria-labelledby="members-heading" className="space-y-3">
      <div className="px-1">
        <h2 id="members-heading" ref={headingRef} tabIndex={-1} className="text-lg font-bold text-nicchyo-ink outline-none">
          お店のメンバー（{data.members.length}人）
        </h2>
        {!canManage && (
          <p className="mt-1 text-sm leading-relaxed text-nicchyo-ink/70">
            メンバーを増やしたり、できることを変えたりしたいときは、代表者か副代表に頼んでください。
          </p>
        )}
        {canManage && data.members.length === 1 && (
          <p className="mt-1 text-sm leading-relaxed text-nicchyo-ink/70">
            まだあなただけです。家族やスタッフを招待すると、近況の投稿などを手伝ってもらえます。
          </p>
        )}
      </div>

      {/* 読み上げに届くよう、知らせが無いときも枠は置いておく */}
      <p role="status" className={notice ? "rounded-btn bg-status-good-bg p-3 text-sm text-status-good-fg ring-1 ring-status-good-line" : "sr-only"}>
        {notice}
      </p>

      <ul className="space-y-3">
        {data.members.map((member) => {
          const ref = toRef(member);
          const canEdit = canManageMember(meRef, ref);
          const canTransfer = canTransferOwnership(meRef, ref);
          const isDeputy = member.role === "member" && member.permissions.includes("members_manage");
          return (
            <li key={member.userId}>
              <Surface padding="sm" className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="break-all text-[15px] font-bold text-nicchyo-ink">{member.name}</span>
                    {member.role === "owner" && <Badge variant="amber">代表者</Badge>}
                    {isDeputy && <Badge variant="info">副代表</Badge>}
                    {member.isMe && <Badge>あなた</Badge>}
                  </div>
                  {member.email && <p className="break-all text-xs text-nicchyo-ink/70">{member.email}</p>}

                  {member.role === "owner" ? (
                    <p className="text-xs text-nicchyo-ink/70">すべての操作ができます。</p>
                  ) : member.permissions.length === SHOP_PERMISSION_KEYS.length ? (
                    // 全部ついているときに札を7つ並べると、スマホで行が長くなりすぎる
                    <p className="text-xs text-nicchyo-ink/70">代表者以外のほぼすべての操作ができます。</p>
                  ) : member.permissions.length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5" aria-label={`${member.name}さんができること`}>
                      {member.permissions.map((permission) => (
                        <li key={permission}>
                          {/* neutral の文字色（ink/65）は 11px では読みにくいので濃くする */}
                          <Badge variant="neutral" className="text-nicchyo-ink/80">
                            {SHOP_PERMISSION_META[permission].label}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-nicchyo-ink/70">お店の情報を見ることができます（編集はできません）。</p>
                  )}
                  <p className="text-xs text-nicchyo-ink/70">{formatJaDate(member.joinedAt)}に参加</p>
                </div>

                {(canEdit || canTransfer) && (
                  <Button
                    variant="secondary"
                    className="w-full shrink-0 sm:w-auto"
                    aria-label={`${member.name}さんの設定を変える`}
                    onClick={() => openSheet(member.userId)}
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
            onChanged={(change) => handleChanged(open.userId, change)}
            onTransferred={onTransferred}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
