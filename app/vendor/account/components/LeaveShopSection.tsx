"use client";

import { useState } from "react";
import { Button, Surface } from "@/components/ui";
import { canLeaveShop } from "@/lib/vendor/memberRules";
import type { ShopMemberRole } from "@/lib/vendor/shopPermissions";
import { leaveShop } from "../../_services/membersService";

/**
 * お店を抜ける。代表者は、先に別のメンバーへ代表者を引き継いでからでないと抜けられない。
 * 抜けると、このアカウントはお店の情報を触れなくなる（ログインは残る）。
 */
export default function LeaveShopSection({ role }: { role: ShopMemberRole }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLeave = async () => {
    setBusy(true);
    setError(null);
    try {
      await leaveShop();
      // 抜けたあとは、お店の画面を開き直さないよう、トップへ移る
      window.location.assign("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "お店を抜けられませんでした");
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="leave-heading" className="space-y-3">
      <h2 id="leave-heading" className="px-1 text-lg font-bold text-nicchyo-ink">
        お店を抜ける
      </h2>
      <Surface padding="sm" className="space-y-3">
        {!canLeaveShop({ role }) ? (
          <p className="text-sm leading-relaxed text-nicchyo-ink/70">
            代表者は、先に別のメンバーへ代表者を引き継いでから、お店を抜けられます。上のメンバー一覧から「代表者を引き継ぐ」を選んでください。
          </p>
        ) : !confirming ? (
          <>
            <p className="text-sm leading-relaxed text-nicchyo-ink/70">
              お店を抜けると、このアカウントではお店の情報を見たり編集したりできなくなります。もう一度参加するには、招待リンクが要ります。
            </p>
            <Button variant="quiet" size="sm" onClick={() => setConfirming(true)}>
              お店を抜ける
            </Button>
          </>
        ) : (
          <div className="space-y-2 rounded-btn bg-status-critical-bg p-3 ring-1 ring-status-critical-line">
            <p className="text-sm text-status-critical-fg">本当に、お店を抜けますか？</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleLeave} disabled={busy}>
                {busy ? "抜けています…" : "抜ける"}
              </Button>
              <Button size="sm" variant="quiet" onClick={() => setConfirming(false)} disabled={busy}>
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
