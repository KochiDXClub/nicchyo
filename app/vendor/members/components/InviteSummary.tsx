import { Badge } from "@/components/ui";
import { formatJaDateTime } from "@/lib/utils/date";
import { SHOP_PERMISSION_META, type ShopPermission } from "@/lib/vendor/shopPermissions";

export type InviteSummaryState = "active" | "expired" | "full" | "revoked";

const STATE_LABEL: Record<InviteSummaryState, { text: string; variant: "amber" | "neutral" | "caution" }> = {
  active: { text: "使えます", variant: "amber" },
  expired: { text: "期限切れ", variant: "neutral" },
  full: { text: "人数に達した", variant: "neutral" },
  revoked: { text: "取り消し済み", variant: "caution" },
};

/**
 * 招待リンク1本の概要（状態・参加人数・期限・付けた権限）。
 * 店舗側の画面と運営の店舗詳細で同じ見た目にするための部品。取り消しボタンなどは children で足す。
 */
export default function InviteSummary({
  invite,
  children,
}: {
  invite: { state: InviteSummaryState; usedCount: number; maxUses: number; expiresAt: string; permissions: readonly ShopPermission[] };
  /** 状態の行の右端に置くもの（取り消しボタンなど） */
  children?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATE_LABEL[invite.state].variant}>{STATE_LABEL[invite.state].text}</Badge>
        <span className="text-sm text-nicchyo-ink">
          {invite.maxUses}人中{invite.usedCount}人が参加
        </span>
        <span className="text-xs text-nicchyo-ink/55">{formatJaDateTime(invite.expiresAt)}まで</span>
        {children}
      </div>
      <p className="text-xs text-nicchyo-ink/70">
        {invite.permissions.length > 0
          ? invite.permissions.map((p) => SHOP_PERMISSION_META[p].label).join("・")
          : "お店の情報を見るだけ"}
      </p>
    </>
  );
}
