import { LISTING_STATUS_LABELS, type ListingStatus } from "@/lib/admin/shopEdit";

const STYLES: Record<ListingStatus, string> = {
  allowed: "bg-green-50 text-green-700 ring-green-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  declined: "bg-red-50 text-red-700 ring-red-200",
};

/** 掲載許可の状態。「許可済み」以外は来訪者に表示されないことが一覧で分かるようにする */
export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STYLES[status]}`}>
      掲載 {LISTING_STATUS_LABELS[status]}
    </span>
  );
}
