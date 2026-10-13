"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import VendorSheet from "@/components/vendor/VendorSheet";
import type { ShopPermission } from "@/lib/vendor/shopPermissions";
import { removeMember, transferOwnership, updateMemberPermissions, type ShopMemberView } from "../../_services/membersService";
import PermissionPicker from "./PermissionPicker";

type Confirm = "remove" | "transfer" | null;

/**
 * メンバー1人の設定（できることを変える・代表者を引き継ぐ・お店から外す）。画面の下から上がってくる。
 * 何ができるか（canEdit / canTransfer / canToggle）は一覧の側が lib/vendor/memberRules.ts で決めて渡す
 * （API も同じ規則で断るので、ここは見せ方）。取り返しのつかない操作は、シートの中で確かめてから行う。
 */
export default function MemberSheet({
  member,
  canEdit,
  canTransfer,
  canToggle,
  onClose,
  onChanged,
  onTransferred,
}: {
  member: ShopMemberView;
  /** 権限の変更と、お店から外すことができる */
  canEdit: boolean;
  /** 代表者を引き継げる（代表者だけ） */
  canTransfer: boolean;
  /** 自分が付け外ししてよい権限か */
  canToggle: (permission: ShopPermission) => boolean;
  onClose: () => void;
  /** 権限の変更・外したあと（一覧を読み直す） */
  onChanged: () => void;
  /** 代表者を引き継いだあと（自分の権限が変わるので、画面を読み直してもらう） */
  onTransferred: () => void;
}) {
  const [draft, setDraft] = useState<ShopPermission[]>(member.permissions);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = draft.length !== member.permissions.length || draft.some((p) => !member.permissions.includes(p));

  const run = async (task: () => Promise<void>, after: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await task();
      onClose();
      after();
    } catch (e) {
      setError(e instanceof Error ? e.message : "うまくいきませんでした");
      setBusy(false);
    }
  };

  const ask = (next: Confirm) => {
    setError(null);
    setConfirm(next);
  };

  return (
    // 確かめる画面に切り替えたら、フォーカスをその中へ移し直す（押したボタンが消えるため）
    <VendorSheet labelledBy="member-sheet-title" busy={busy} onClose={onClose} focusKey={confirm}>
      <div className="space-y-5 px-5 pt-4" aria-busy={busy}>
        <div>
          <h2 id="member-sheet-title" className="text-xl font-bold text-nicchyo-ink">
            {member.name}さんの設定
          </h2>
          {member.email && <p className="mt-0.5 break-all text-xs text-nicchyo-ink/55">{member.email}</p>}
        </div>

        {confirm === null && canEdit && (
          <section aria-labelledby="member-sheet-permissions" className="space-y-3">
            <h3 id="member-sheet-permissions" className="text-sm font-bold text-nicchyo-ink">
              できること
            </h3>
            <PermissionPicker value={draft} onChange={setDraft} canToggle={canToggle} idPrefix={`edit-${member.userId}`} disabled={busy} />
            {/* 権限の一覧が長く、スマホでは保存が画面の外に出るので、シートの下に貼りつける */}
            <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-nicchyo-base px-5 py-3">
              <Button className="flex-1" disabled={busy || !dirty} onClick={() => run(() => updateMemberPermissions(member.userId, draft), onChanged)}>
                {busy ? "保存しています…" : "保存する"}
              </Button>
              <Button variant="quiet" disabled={busy} onClick={onClose}>
                やめる
              </Button>
            </div>
          </section>
        )}

        {confirm === null && (canTransfer || canEdit) && (
          <section aria-labelledby="member-sheet-other" className="space-y-2 border-t border-line pt-4">
            <h3 id="member-sheet-other" className="text-sm font-bold text-nicchyo-ink">
              そのほかの操作
            </h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              {canTransfer && (
                <Button variant="quiet" className="sm:flex-1" disabled={busy} onClick={() => ask("transfer")}>
                  代表者を引き継ぐ
                </Button>
              )}
              {canEdit && (
                <Button variant="quiet" className="text-status-critical-fg sm:flex-1" disabled={busy} onClick={() => ask("remove")}>
                  お店から外す
                </Button>
              )}
            </div>
          </section>
        )}

        {confirm === "remove" && (
          <div className="space-y-3 rounded-btn bg-status-critical-bg p-4 ring-1 ring-status-critical-line">
            <p className="text-sm leading-relaxed text-status-critical-fg">
              {member.name}さんを、お店から外します。この人は、お店の情報を見たり編集したりできなくなります。もう一度入ってもらうには、招待リンクを送り直します。
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="sm:flex-1" disabled={busy} onClick={() => run(() => removeMember(member.userId), onChanged)}>
                {busy ? "外しています…" : "外す"}
              </Button>
              <Button variant="quiet" disabled={busy} onClick={() => ask(null)}>
                やめる
              </Button>
            </div>
          </div>
        )}

        {confirm === "transfer" && (
          <div className="space-y-3 rounded-btn bg-status-warning-bg p-4 ring-1 ring-status-warning-line">
            <p className="text-sm leading-relaxed text-status-warning-fg">
              代表者を{member.name}さんに引き継ぎます。あなたは、代表者以外のほぼすべての操作ができる「副代表」として残ります。代表者を戻したいときは、{member.name}さんに引き継ぎ直してもらいます。
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="sm:flex-1" disabled={busy} onClick={() => run(() => transferOwnership(member.userId), onTransferred)}>
                {busy ? "引き継いでいます…" : "代表者を引き継ぐ"}
              </Button>
              <Button variant="quiet" disabled={busy} onClick={() => ask(null)}>
                やめる
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-btn bg-status-critical-bg p-3 text-sm text-status-critical-fg ring-1 ring-status-critical-line">
            {error}
          </p>
        )}
      </div>
    </VendorSheet>
  );
}
