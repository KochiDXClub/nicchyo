"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { CenteredLoading } from "@/components/ui/loading-spinner";
import {
  VENDOR_INQUIRY_REPLY_BODY_MAX_LENGTH,
  isAllowedVendorInquiryImageUrl,
} from "@/lib/vendorInquiries/constants";
import {
  CATEGORY_LABELS,
  SENDER_ROLE_LABELS,
  TOPIC_LABELS,
  URGENCY_LABELS,
  statusLabel,
} from "@/lib/vendorInquiries/labels";
import {
  fetchInquiryDetail,
  replyToInquiry,
  type VendorInquiry,
  type VendorInquiryReply,
} from "../../_services/inquiriesService";

const TONE_CLASSES = {
  waiting: "bg-slate-100 text-slate-600",
  progress: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
} as const;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VendorInquiryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [inquiry, setInquiry] = useState<VendorInquiry | null>(null);
  const [replies, setReplies] = useState<VendorInquiryReply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [replyBody, setReplyBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchInquiryDetail(id)
      .then(({ inquiry: fetched, replies: fetchedReplies }) => {
        setInquiry(fetched);
        setReplies(fetchedReplies);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "読み込みに失敗しました"))
      .finally(() => setIsLoading(false));
  }, [id]);

  async function handleReply() {
    if (!id || isSending || !replyBody.trim()) return;
    setIsSending(true);
    setReplyError(null);
    try {
      const reply = await replyToInquiry(id, replyBody.trim());
      setReplies((prev) => [...prev, reply]);
      setReplyBody("");
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : "返信できませんでした");
    } finally {
      setIsSending(false);
    }
  }

  // 報告・連絡は返信を前提としない一方向の共有なので、出店者側に返信欄を出さない
  // （#470 の設計方針。APIとDBは返信自体を許容している）
  const canReply = inquiry !== null && inquiry.topic !== "report";

  // DBに入っている image_url を信用せず、表示の直前に検証し直す。
  // 作成APIでも検証しているが、INSERTポリシーは vendor_id しか見ていないため、
  // 出店者はAPIを通さずPostgRESTから直接任意の値を入れられる（#527 のレビュー参照）。
  // 通らなければ画像は出さない（next/image は remotePatterns 外のホストで例外を投げ、
  // 画面ごと落ちるため、その意味でも表示前に弾く必要がある）
  const safeImageUrl =
    inquiry?.image_url && isAllowedVendorInquiryImageUrl(inquiry.image_url) ? inquiry.image_url.trim() : null;

  return (
    <div className="min-h-screen bg-[#FFFAF0] pb-24">
      <div className="border-b border-amber-100 bg-white/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href="/vendor/inquiries"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            aria-label="連絡の一覧へ戻る"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-600">Contact</p>
            <h1 className="text-xl font-bold text-slate-900">
              {inquiry ? TOPIC_LABELS[inquiry.topic].label : "連絡の内容"}
            </h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-5">
        {isLoading ? (
          <CenteredLoading size={24} padding="py-10" />
        ) : error || !inquiry ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error ?? "連絡が見つかりませんでした"}
          </div>
        ) : (
          <>
            {/* 送った内容 */}
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONE_CLASSES[statusLabel(inquiry.status).tone]}`}>
                  {statusLabel(inquiry.status).label}
                </span>
                <span className="text-[11px] text-slate-400">{CATEGORY_LABELS[inquiry.category]}へ</span>
                <span className="text-[11px] text-slate-400">{URGENCY_LABELS[inquiry.urgency].label}</span>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-slate-800">{inquiry.body}</p>

              {safeImageUrl && (
                <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                  <Image
                    src={safeImageUrl}
                    alt="添付画像"
                    width={640}
                    height={360}
                    className="h-auto w-full object-cover"
                  />
                </div>
              )}

              <p className="mt-3 text-[11px] text-slate-400">{formatDateTime(inquiry.created_at)} に送信</p>
            </section>

            {/* やり取り */}
            {replies.length > 0 && (
              <section className="space-y-3">
                {replies.map((reply) => {
                  const isMine = reply.sender_role === "vendor";
                  return (
                    <div
                      key={reply.id}
                      className={`rounded-3xl border p-4 shadow-sm ${
                        isMine ? "border-amber-200 bg-amber-50/70" : "border-slate-200 bg-white"
                      }`}
                    >
                      <p className="text-[11px] font-bold text-slate-500">
                        {SENDER_ROLE_LABELS[reply.sender_role]}
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap text-base leading-relaxed text-slate-800">
                        {reply.body}
                      </p>
                      <p className="mt-2 text-[11px] text-slate-400">{formatDateTime(reply.created_at)}</p>
                    </div>
                  );
                })}
              </section>
            )}

            {/* 返信 */}
            {canReply ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-700">返信する</h2>
                  <span className="text-xs text-slate-400">
                    {replyBody.length} / {VENDOR_INQUIRY_REPLY_BODY_MAX_LENGTH}
                  </span>
                </div>
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={5}
                  placeholder="追加で伝えたいことがあれば書いてください"
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base leading-relaxed text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
                />

                {replyError && (
                  <div className="mt-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {replyError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleReply}
                  disabled={
                    isSending ||
                    !replyBody.trim() ||
                    replyBody.length > VENDOR_INQUIRY_REPLY_BODY_MAX_LENGTH
                  }
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-3xl bg-amber-500 py-3.5 text-base font-bold text-white shadow transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {isSending ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      送信しています...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      返信を送る
                    </>
                  )}
                </button>
              </section>
            ) : (
              <p className="px-1 text-sm leading-relaxed text-slate-500">
                報告・連絡は一方向のお知らせです。運営が内容を確認すると、ステータスが「確認済み」に変わります。
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
