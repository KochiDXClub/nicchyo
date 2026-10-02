"use client";

import { CheckCircle2, Clock, PencilLine, XCircle } from "lucide-react";
import { Badge, Button, Surface } from "@/components/ui";
import type { ReviewStatus } from "@/lib/vendor/character/types";

type Props = {
  status: ReviewStatus;
  /** 承認済みのオリジナルを、お店のキャラにしているか */
  inUse: boolean;
  onUse: () => void;
  /** モック専用：運営の結果を画面で確かめるための切り替え */
  onMockReview: (result: "approved" | "rejected") => void;
};

/** オリジナルキャラの、運営の確認の状況 */
export default function ReviewStatusCard({ status, inUse, onUse, onMockReview }: Props) {
  return (
    <Surface className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-nicchyo-ink/70">運営の確認</h3>
        {status.state === "draft" && <Badge>下書き</Badge>}
        {status.state === "pending" && <Badge variant="amber">確認中</Badge>}
        {status.state === "approved" && <Badge variant="info">承認ずみ</Badge>}
        {status.state === "rejected" && <Badge variant="caution">差し戻し</Badge>}
      </div>

      {status.state === "draft" && (
        <p className="flex items-start gap-2 text-sm leading-relaxed text-nicchyo-ink/70">
          <PencilLine size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          まだ申請していません。話し方を試して、よければ申請してください。
        </p>
      )}
      {status.state === "pending" && (
        <p className="flex items-start gap-2 text-sm leading-relaxed text-nicchyo-ink/70">
          <Clock size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          運営が確認しています。結果はお知らせでお伝えします。
        </p>
      )}
      {status.state === "approved" && (
        <>
          <p className="flex items-start gap-2 text-sm leading-relaxed text-nicchyo-ink/70">
            <CheckCircle2 size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            確認が済みました。お店のキャラにできます。内容を変えると、もう一度確認が要ります。
          </p>
          <Button className="w-full" disabled={inUse} onClick={onUse}>
            {inUse ? "このキャラを使っています" : "お店のキャラにする"}
          </Button>
        </>
      )}
      {status.state === "rejected" && (
        <p className="flex items-start gap-2 text-sm leading-relaxed text-rose-700">
          <XCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          {status.reason} 直してから、もう一度申請してください。
        </p>
      )}

      {status.state === "pending" && (
        <div className="rounded-btn border border-dashed border-line-warm px-3 py-2.5">
          <p className="text-xs font-bold text-nicchyo-ink/55">モック用：運営の結果を切り替える</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="quiet" onClick={() => onMockReview("approved")}>承認にする</Button>
            <Button size="sm" variant="quiet" onClick={() => onMockReview("rejected")}>差し戻しにする</Button>
          </div>
        </div>
      )}
    </Surface>
  );
}
