"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { NOTICE_SENDER_LABELS } from "@/lib/vendor/notices";
import { confirmNotice, type VendorNotice } from "../../_services/noticesService";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

function NoticeItem({ notice, onConfirmed }: { notice: VendorNotice; onConfirmed: (id: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setSaving(true);
    setError(null);
    try {
      await confirmNotice(notice.id);
      onConfirmed(notice.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "うまく記録できんかった。");
      setSaving(false);
    }
  };

  return (
    <li
      className={cn(
        "rounded-card bg-white p-4 shadow-card ring-1",
        notice.confirmed ? "ring-line" : "ring-amber-300"
      )}
    >
      <p className="flex flex-wrap items-center gap-2 text-xs text-nicchyo-ink/55">
        {notice.important && <Badge variant="caution">大事</Badge>}
        <span className="font-bold text-amber-900">{NOTICE_SENDER_LABELS[notice.sender]}</span>
        <span>{formatDate(notice.createdAt)}</span>
      </p>
      <h3 className="mt-1.5 text-base font-bold text-nicchyo-ink">{notice.title}</h3>
      <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-nicchyo-ink/80">{notice.body}</p>

      <div className="mt-3">
        {notice.confirmed ? (
          <p className="flex items-center gap-1 text-sm font-semibold text-nicchyo-ink/55">
            <Check size={16} aria-hidden="true" />
            確認しました
          </p>
        ) : (
          <Button size="md" onClick={() => void confirm()} disabled={saving}>
            確認しました
          </Button>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-rose-600">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * 運営・市役所からのお知らせ。読んだら「確認しました」を押してもらう（運営に確認した数が届く）。
 */
export default function NoticeList({
  notices,
  onConfirmed,
}: {
  notices: VendorNotice[];
  onConfirmed: (id: string) => void;
}) {
  const unconfirmed = notices.filter((n) => !n.confirmed).length;
  return (
    <section id="notices" aria-labelledby="notices-heading" className="scroll-mt-4">
      <h2 id="notices-heading" className="mb-2.5 px-1 text-lg font-bold text-nicchyo-ink">
        運営・市役所からのお知らせ
        {unconfirmed > 0 && (
          <span className="ml-2 text-sm font-semibold text-amber-800">まだ確認していない {unconfirmed}件</span>
        )}
      </h2>
      <ul className="flex flex-col gap-3">
        {notices.map((notice) => (
          <NoticeItem key={notice.id} notice={notice} onConfirmed={onConfirmed} />
        ))}
      </ul>
    </section>
  );
}
