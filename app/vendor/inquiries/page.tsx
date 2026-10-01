"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, ChevronRight, Inbox } from "lucide-react";
import { CenteredLoading } from "@/components/ui/loading-spinner";
import { fetchMyInquiries, type VendorInquiry } from "../_services/inquiriesService";
import { CATEGORY_LABELS, TOPIC_LABELS, statusLabel } from "@/lib/vendorInquiries/labels";

const TONE_CLASSES = {
  waiting: "bg-slate-100 text-slate-600",
  progress: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
} as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 本文の1行目だけを見出しとして使う（定型パターンなら【出店を最後にする】等が出る） */
function summarize(body: string): string {
  const firstLine = body.split("\n").find((line) => line.trim()) ?? "";
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine;
}

export default function VendorInquiriesPage() {
  const [inquiries, setInquiries] = useState<VendorInquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyInquiries()
      .then(setInquiries)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "読み込みに失敗しました"))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFAF0] pb-24">
      <div className="border-b border-amber-100 bg-white/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href="/my-shop"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            aria-label="マイ店舗へ戻る"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-600">Contact</p>
            <h1 className="text-xl font-bold text-slate-900">運営・市役所に連絡</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-5">
        <Link
          href="/vendor/inquiries/new"
          className="flex w-full items-center justify-center gap-2 rounded-3xl bg-amber-500 py-4 text-base font-bold text-white shadow transition hover:bg-amber-400 active:scale-[0.99]"
        >
          <Plus size={18} />
          新しく連絡する
        </Link>

        {error && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {isLoading ? (
          <CenteredLoading size={24} padding="py-10" />
        ) : inquiries.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-10 text-center shadow-sm">
            <Inbox size={32} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-600">まだ連絡はありません</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              聞きたいこと・伝えたいことがあれば、上のボタンから送れます。
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {inquiries.map((inquiry) => {
              const topic = TOPIC_LABELS[inquiry.topic];
              const status = statusLabel(inquiry.status);
              return (
                <Link
                  key={inquiry.id}
                  href={`/vendor/inquiries/${inquiry.id}`}
                  className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-amber-200 hover:bg-amber-50/40"
                >
                  <span className="mt-0.5 text-2xl" aria-hidden="true">{topic.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{topic.label}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONE_CLASSES[status.tone]}`}>
                        {status.label}
                      </span>
                      <span className="text-[11px] text-slate-400">{CATEGORY_LABELS[inquiry.category]}へ</span>
                    </div>
                    <p className="mt-1.5 truncate text-sm text-slate-600">{summarize(inquiry.body)}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{formatDate(inquiry.created_at)}</p>
                  </div>
                  <ChevronRight size={16} className="mt-1 shrink-0 text-amber-300" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
