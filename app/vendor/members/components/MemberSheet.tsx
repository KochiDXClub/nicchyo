"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import VendorSheet from "@/components/vendor/VendorSheet";
import { cn } from "@/lib/utils/cn";
import type { ShopPermission } from "@/lib/vendor/shopPermissions";
import { removeMember, transferOwnership, updateMemberPermissions, type ShopMemberView } from "../../_services/membersService";
import PermissionPicker from "./PermissionPicker";

type Confirm = "remove" | "transfer";

/** 変えた・外したあとに、一覧の側で知らせる内容 */
export type MemberChange = { kind: "permissions" | "remove"; message: string };

/**
 * メンバー1人の設定（できることを変える・代表者を引き継ぐ・お店から外す）。画面の下から上がってくる。
 * 何ができるか（canEdit / canTransfer / canToggle）は一覧の側が lib/vendor/memberRules.ts で決めて渡す
 * （API も同じ規則で断るので、ここは見せ方）。取り返しのつかない操作は、シートの中で確かめてから行う。
 *
 * フォーカス: 確かめる画面に切り替えたら、実行ボタンではなく説明の文へ移す（Enter を続けて押して、確かめずに実行しないように。
 * 読み上げでも、何が起きるかが先に読まれる）。「やめる」で戻ったら、確かめる画面を開いたボタンへ戻す。
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
  /** 権限の変更・外したあと（一覧を読み直し、結果を知らせる） */
  onChanged: (change: MemberChange) => void;
  /** 代表者を引き継いだあと（自分の権限が変わるので、画面を読み直してもらう） */
  onTransferred: () => void;
}) {
  const [draft, setDraft] = useState<ShopPermission[]>(member.permissions);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  // 確かめる画面を「やめる」で閉じたとき、フォーカスを戻すボタン
  const [returnTo, setReturnTo] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = draft.length !== member.permissions.length || draft.some((p) => !member.permissions.includes(p));

  // 成功したら閉じる。閉じると一覧がこのシートを外す（AnimatePresence の退場中も busy のままなので、二度押しや Esc は効かない）
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
    setReturnTo(null);
    setConfirm(next);
  };

  const cancel = () => {
    setError(null);
    setReturnTo(confirm);
    setConfirm(null);
  };

  const errorText = error && (
    <p role="alert" className="rounded-btn bg-status-critical-bg p-3 text-sm text-status-critical-fg ring-1 ring-status-critical-line">
      {error}
    </p>
  );

  return (
    // focusKey が変わるたびに、[data-autofocus] の付いた所（無ければ最初に押せる所）へフォーカスを移し直す
    <VendorSheet labelledBy="member-sheet-title" busy={busy} onClose={onClose} focusKey={confirm ?? `back-${returnTo ?? ""}`}>
      <div className="space-y-5 px-5 pt-4" aria-busy={busy}>
        <div>
          <h2 id="member-sheet-title" className="text-xl font-bold text-nicchyo-ink">
            {member.name}さんの設定
          </h2>
          {member.email && <p className="mt-0.5 break-all text-xs text-nicchyo-ink/70">{member.email}</p>}
        </div>

        {confirm === null && canEdit && (
          <section aria-labelledby="member-sheet-permissions" className="space-y-3">
            <h3 id="member-sheet-permissions" className="text-sm font-bold text-nicchyo-ink">
              できること
            </h3>
            <PermissionPicker value={draft} onChange={setDraft} canToggle={canToggle} idPrefix={`edit-${member.userId}`} disabled={busy} />
            {/*
              変えたあとは、一覧が長くても保存を押せるよう、シートの下に貼りつける。
              変える前は貼りつけない（貼りつけると、その下の「そのほかの操作」が無いように見える）
            */}
            <div className={cn("-mx-5 space-y-2 border-t border-line-warm bg-nicchyo-base px-5 py-3", dirty && "sticky bottom-0")}>
              {errorText}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={busy || !dirty}
                  onClick={() =>
                    run(
                      () => updateMemberPermissions(member.userId, draft),
                      () => onChanged({ kind: "permissions", message: `${member.name}さんのできることを変えました` }),
                    )
                  }
                >
                  {busy ? "保存しています…" : "保存する"}
                </Button>
                <Button variant="quiet" disabled={busy} onClick={onClose}>
                  閉じる
                </Button>
              </div>
            </div>
          </section>
        )}

        {confirm === null && (canTransfer || canEdit) && (
          <section aria-labelledby="member-sheet-other" className="space-y-2">
            <h3 id="member-sheet-other" className="text-sm font-bold text-nicchyo-ink">
              そのほかの操作
            </h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              {canTransfer && (
                <Button
                  variant="quiet"
                  className="sm:flex-1"
                  disabled={busy}
                  data-autofocus={returnTo === "transfer" ? true : undefined}
                  onClick={() => ask("transfer")}
                >
                  代表者を引き継ぐ
                </Button>
              )}
              {canEdit && (
                <Button
                  variant="quiet"
                  className="text-status-critical-fg sm:flex-1"
                  disabled={busy}
                  data-autofocus={returnTo === "remove" ? true : undefined}
                  onClick={() => ask("remove")}
                >
                  お店から外す
                </Button>
              )}
            </div>
            {/* 権限を変えられない人（代表者が副代表を見るとき以外）には、ここにエラーを出す */}
            {!canEdit && errorText}
          </section>
        )}

        {confirm === "remove" && (
          <div className="space-y-3 rounded-btn bg-status-critical-bg p-4 ring-1 ring-status-critical-line">
            <p id="member-sheet-confirm" tabIndex={-1} data-autofocus className="text-sm leading-relaxed text-status-critical-fg outline-none">
              {member.name}さんを、お店から外します。この人は、お店の情報を見たり編集したりできなくなります。もう一度入ってもらうには、招待リンクを送り直します。
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="sm:flex-1"
                aria-describedby="member-sheet-confirm"
                disabled={busy}
                onClick={() =>
                  run(
                    () => removeMember(member.userId),
                    () => onChanged({ kind: "remove", message: `${member.name}さんをお店から外しました` }),
                  )
                }
              >
                {busy ? "外しています…" : "外す"}
              </Button>
              <Button variant="quiet" disabled={busy} onClick={cancel}>
                やめる
              </Button>
            </div>
            {errorText}
          </div>
        )}

        {confirm === "transfer" && (
          <div className="space-y-3 rounded-btn bg-status-warning-bg p-4 ring-1 ring-status-warning-line">
            <p id="member-sheet-confirm" tabIndex={-1} data-autofocus className="text-sm leading-relaxed text-status-warning-fg outline-none">
              代表者を{member.name}さんに引き継ぎます。あなたは、代表者以外のほぼすべての操作ができる「副代表」として残ります。代表者を戻したいときは、{member.name}さんに引き継ぎ直してもらいます。
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="sm:flex-1"
                aria-describedby="member-sheet-confirm"
                disabled={busy}
                onClick={() => run(() => transferOwnership(member.userId), onTransferred)}
              >
                {busy ? "引き継いでいます…" : "代表者を引き継ぐ"}
              </Button>
              <Button variant="quiet" disabled={busy} onClick={cancel}>
                やめる
              </Button>
            </div>
            {errorText}
          </div>
        )}
      </div>
    </VendorSheet>
  );
}
