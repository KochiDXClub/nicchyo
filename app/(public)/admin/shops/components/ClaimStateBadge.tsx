import type { ShopClaimState } from "@/lib/vendor/shopClaim";

const STATE_LABEL: Record<ShopClaimState, { text: string; className: string }> = {
  claimed: { text: "代表者あり", className: "bg-green-700 text-white" },
  qr_issued: { text: "QR発行済み・未紐づけ", className: "bg-amber-600 text-white" },
  unclaimed: { text: "未発行", className: "bg-nicchyo-ink/60 text-white" },
};

/** 店舗と出店者アカウントの紐づけの状態。QR の一覧と店舗の詳細で同じ札を使う */
export function ClaimStateBadge({ state }: { state: ShopClaimState }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${STATE_LABEL[state].className}`}>
      {STATE_LABEL[state].text}
    </span>
  );
}
