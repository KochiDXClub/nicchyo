import { LISTING_STATUS_LABELS, type ListingStatus } from "@/lib/admin/shopEdit";

const STYLES: Record<ListingStatus, string> = {
  allowed: "bg-status-good-bg text-status-good-fg ring-status-good-line",
  pending: "bg-status-warning-bg text-status-warning-fg ring-status-warning-line",
  declined: "bg-status-critical-bg text-status-critical-fg ring-status-critical-line",
};

/** 掲載許可の状態。「許可済み」以外は来訪者に表示されないことが一覧で分かるようにする */
export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STYLES[status]}`}>
      掲載 {LISTING_STATUS_LABELS[status]}
    </span>
  );
}
