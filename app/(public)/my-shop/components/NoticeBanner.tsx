"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Mail } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { NOTICE_SENDER_LABELS } from "@/lib/vendor/notices";
import { fetchNotices, type VendorNotice } from "@/app/vendor/_services/noticesService";

/** 見出しまで並べる件数。それより多いときは件数だけ */
const MAX_TITLES = 3;

/**
 * 運営・市役所からの、まだ確認していないお知らせ。毎週開く出店者ページのいちばん上で知らせ、
 * 連絡ページのお知らせへ連れていく。全部確認したら出さない。大事なお知らせがあれば目立たせる。
 */
export default function NoticeBanner() {
  const [unconfirmed, setUnconfirmed] = useState<VendorNotice[]>([]);

  useEffect(() => {
    fetchNotices()
      .then((notices) => setUnconfirmed(notices.filter((n) => !n.confirmed)))
      .catch(() => {
        // 読めなくても出店者ページは使えるので、静かに出さない
      });
  }, []);

  if (unconfirmed.length === 0) return null;
  const important = unconfirmed.some((n) => n.important);

  return (
    <Link
      href="/vendor/inquiries#notices"
      className={cn(
        "flex items-start gap-3 rounded-panel px-4 py-4 shadow-card transition active:scale-[0.99] motion-reduce:active:scale-100",
        important ? "bg-amber-500 text-white" : "bg-white/90 text-nicchyo-ink ring-1 ring-amber-200 backdrop-blur-sm"
      )}
    >
      <Mail size={22} aria-hidden="true" className={cn("mt-0.5 shrink-0", !important && "text-amber-600")} />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold">
          {important ? "大事なお知らせがあります" : "運営・市役所からお知らせがあります"}
          <span className="ml-1.5 text-sm font-semibold">{unconfirmed.length}件</span>
        </span>
        {unconfirmed.length <= MAX_TITLES && (
          <span className="mt-1 block space-y-0.5">
            {unconfirmed.map((n) => (
              <span key={n.id} className={cn("block truncate text-sm", important ? "text-white/90" : "text-nicchyo-ink/70")}>
                {NOTICE_SENDER_LABELS[n.sender]}：{n.title}
              </span>
            ))}
          </span>
        )}
      </span>
      <ChevronRight size={20} aria-hidden="true" className={cn("mt-0.5 shrink-0", important ? "text-white/80" : "text-amber-400")} />
    </Link>
  );
}
