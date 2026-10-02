"use client";

import { useState } from "react";
import { Button, Surface } from "@/components/ui";
import { apiRequest } from "@/lib/utils/apiRequest";
import type { ShopMemberRole } from "@/lib/vendor/shopPermissions";
import { createClient } from "@/utils/supabase/client";

/** 退会の確認で入力してもらう言葉（うっかり押しても退会にならないように） */
export const WITHDRAW_CONFIRM_WORD = "退会する";

/**
 * 退会（このアカウントを消す）。取り消せないので、何が消えて何が残るかを先に書き、言葉を入力してもらってから実行する。
 * 代表者は、ほかにメンバーがいる間は退会できない（先に代表者を引き継ぐ）。
 */
export default function WithdrawSection({ role, hasOtherMembers }: { role: ShopMemberRole; hasOtherMembers: boolean }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = role === "owner" && hasOtherMembers;
  const isSoleOwner = role === "owner" && !hasOtherMembers;

  const handleWithdraw = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/api/vendor/account/delete", { method: "DELETE", body: { confirm: true } }, "退会できませんでした。もう一度お試しください。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "退会できませんでした。もう一度お試しください。");
      setBusy(false);
      return;
    }
    // アカウントは消えたので、ブラウザに残っているログインの情報も捨てて、トップへ移る（失敗しても移る）
    await createClient().auth.signOut({ scope: "local" }).catch(() => undefined);
    window.location.assign("/");
  };

  return (
    <section aria-labelledby="withdraw-heading" className="space-y-3">
      <h2 id="withdraw-heading" className="px-1 text-lg font-bold text-nicchyo-ink">
        退会とデータの削除
      </h2>
      <Surface padding="sm" className="space-y-3">
        <div className="space-y-2 text-sm leading-relaxed text-nicchyo-ink/70">
          <p className="font-semibold text-nicchyo-ink">退会すると消えるもの</p>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>このログインアカウント（名前・メールアドレス）</li>
            {isSoleOwner && <li>お店の代表者として登録した、あなたの氏名と公開の設定</li>}
            <li>操作ログに残っている、あなたの名前（「退会したメンバーに関する記録」になります）</li>
          </ul>
          <p className="pt-1 font-semibold text-nicchyo-ink">残るもの</p>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>お店の掲載情報（店名・商品・写真・近況）。公開されている情報なので、そのまま残ります。消したいときは、退会の前に「運営・市役所との連絡」から伝えてください</li>
            {isSoleOwner && <li>代表者がいなくなったお店は、運営が次の代表者のQRコードを出すまで、アカウントなしの状態になります</li>}
            <li>運営・市役所とのやりとりの内容（送った人の名前は残りません）</li>
          </ul>
          <p className="pt-1">退会は取り消せません。</p>
        </div>

        {blocked ? (
          <p className="rounded-btn bg-status-warning-bg p-3 text-sm text-status-warning-fg ring-1 ring-status-warning-line">
            代表者は、ほかにメンバーがいる間は退会できません。先に、上のメンバー一覧から別のメンバーへ「代表者を引き継ぐ」を選んでください。
          </p>
        ) : !open ? (
          <Button variant="quiet" size="sm" onClick={() => setOpen(true)}>
            退会の手続きへ進む
          </Button>
        ) : (
          <div className="space-y-3 rounded-btn bg-status-critical-bg p-3 ring-1 ring-status-critical-line">
            <label htmlFor="withdraw-confirm" className="block text-sm text-status-critical-fg">
              退会するには、下の欄に「{WITHDRAW_CONFIRM_WORD}」と入力してください。
            </label>
            <input
              id="withdraw-confirm"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              autoComplete="off"
              disabled={busy}
              className="w-full rounded-btn bg-white px-3 py-2 text-sm text-nicchyo-ink ring-1 ring-line"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleWithdraw} disabled={busy || word.trim() !== WITHDRAW_CONFIRM_WORD}>
                {busy ? "退会しています…" : "退会する"}
              </Button>
              <Button size="sm" variant="quiet" onClick={() => { setOpen(false); setWord(""); }} disabled={busy}>
                やめる
              </Button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-status-critical-fg">
            {error}
          </p>
        )}
      </Surface>
    </section>
  );
}
