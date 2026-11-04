"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader, EmptyState } from "@/components/admin";
import { InboxTabs } from "@/components/admin/InboxTabs";
import { notifyInboxChanged } from "@/lib/hooks/useAdminInboxCounts";
import { showToast } from "@/lib/admin/toast";
import {
  VENDOR_INQUIRY_OPEN_STATUSES,
  VENDOR_INQUIRY_REPLY_BODY_MAX_LENGTH,
  isAllowedVendorInquiryImageUrl,
  type VendorInquiryTopic,
} from "@/lib/vendorInquiries/constants";
import { CATEGORY_LABELS, TOPIC_LABELS, URGENCY_LABELS, statusLabel } from "@/lib/vendorInquiries/labels";
import type { VendorInquiryReplyRow, VendorInquiryRow } from "@/types/database.extensions";

/** 一覧API（/api/admin/vendor-inquiries）は店名を添えて返す */
type AdminVendorInquiry = VendorInquiryRow & { shop_name: string | null };

const OPEN_STATUSES: readonly string[] = VENDOR_INQUIRY_OPEN_STATUSES;

/** 運営がステータスを進める操作。topic ごとに許される status が違う（lib/vendorInquiries/constants.ts） */
const STATUS_ACTIONS: Record<VendorInquiryTopic, { status: string; label: string }[]> = {
  report: [{ status: "confirmed", label: "確認済みにする" }],
  consultation: [
    { status: "in_progress", label: "検討中にする" },
    { status: "resolved", label: "回答済みにする" },
  ],
  question: [{ status: "human_answered", label: "回答済みにする" }],
};

const TONE_CLASSES = {
  waiting: "bg-red-100 text-red-800",
  progress: "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-800",
} as const;

const REPLY_ROLE_LABELS: Record<VendorInquiryReplyRow["sender_role"], string> = {
  vendor: "出店者",
  operator: "nicchyo運営",
  city: "高知市役所（運営が代理で返信）",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function readError(res: Response, fallback: string): Promise<string> {
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  return json?.error ?? fallback;
}

export default function AdminVendorInquiriesPage() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();

  const [inquiries, setInquiries] = useState<AdminVendorInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"open" | "all">("open");
  const [topicFilter, setTopicFilter] = useState<VendorInquiryTopic | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isModerator) router.push("/");
  }, [isLoading, permissions.isModerator, router]);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (topicFilter !== "all") params.set("topic", topicFilter);
      const res = await fetch(`/api/admin/vendor-inquiries?${params.toString()}`);
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { inquiries: AdminVendorInquiry[] };
      setInquiries(data.inquiries);
    } catch {
      showToast.error("出店者からの連絡の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [topicFilter]);

  useEffect(() => {
    if (!permissions.isModerator) return;
    void fetchInquiries();
  }, [fetchInquiries, permissions.isModerator]);

  const visible = useMemo(
    () => (statusFilter === "open" ? inquiries.filter((i) => OPEN_STATUSES.includes(i.status)) : inquiries),
    [inquiries, statusFilter]
  );

  const handleChanged = () => {
    void fetchInquiries();
    notifyInboxChanged();
  };

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="受信トレイ"
        title="出店者からの連絡"
        description="出店者が「連絡する」から送った質問・報告・相談。新しい順に表示します"
      />
      <InboxTabs />

      <div className="mx-auto max-w-4xl px-4 py-4">
        <div className="mb-4 flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "open" | "all")}
            className="rounded-btn border border-line bg-white px-3 py-1.5 text-sm text-nicchyo-ink"
            aria-label="状態で絞り込む"
          >
            <option value="open">対応が必要なもの</option>
            <option value="all">すべて</option>
          </select>
          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value as VendorInquiryTopic | "all")}
            className="rounded-btn border border-line bg-white px-3 py-1.5 text-sm text-nicchyo-ink"
            aria-label="用件で絞り込む"
          >
            <option value="all">すべての用件</option>
            {(Object.entries(TOPIC_LABELS) as [VendorInquiryTopic, { label: string }][]).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-nicchyo-ink/40">読み込み中...</div>
        ) : visible.length === 0 ? (
          <EmptyState title="該当する連絡はありません" />
        ) : (
          <ul className="space-y-3">
            {visible.map((inquiry) => (
              <InquiryCard
                key={inquiry.id}
                inquiry={inquiry}
                expanded={openId === inquiry.id}
                onToggle={() => setOpenId((cur) => (cur === inquiry.id ? null : inquiry.id))}
                onChanged={handleChanged}
              />
            ))}
          </ul>
        )}
      </div>
    </AdminLayout>
  );
}

function InquiryCard({
  inquiry,
  expanded,
  onToggle,
  onChanged,
}: {
  inquiry: AdminVendorInquiry;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const status = statusLabel(inquiry.status);
  const [replies, setReplies] = useState<VendorInquiryReplyRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyAs, setReplyAs] = useState<"operator" | "city">("operator");
  const [busy, setBusy] = useState(false);

  const loadReplies = useCallback(async () => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/vendor-inquiries/${inquiry.id}`);
      if (!res.ok) throw new Error(await readError(res, "取得に失敗しました"));
      const data = (await res.json()) as { replies: VendorInquiryReplyRow[] };
      setReplies(data.replies);
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "やり取りの取得に失敗しました");
    } finally {
      setDetailLoading(false);
    }
  }, [inquiry.id]);

  useEffect(() => {
    if (expanded) void loadReplies();
  }, [expanded, loadReplies]);

  const changeStatus = async (next: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/vendor-inquiries/${inquiry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error(await readError(res, "更新に失敗しました"));
      showToast.success(`「${statusLabel(next).label}」に変更しました`);
      onChanged();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (busy || !replyBody.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/vendor-inquiries/${inquiry.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody.trim(), sender_role: replyAs }),
      });
      if (!res.ok) throw new Error(await readError(res, "送信に失敗しました"));
      const data = (await res.json()) as { reply: VendorInquiryReplyRow };
      setReplies((prev) => [...prev, data.reply]);
      setReplyBody("");
      showToast.success("返信しました");
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  // 出店者がAPIを通さず直接入れた値の可能性があるので、表示の直前に検証し直す
  const safeImageUrl =
    inquiry.image_url && isAllowedVendorInquiryImageUrl(inquiry.image_url) ? inquiry.image_url.trim() : null;
  const actions = STATUS_ACTIONS[inquiry.topic].filter((a) => a.status !== inquiry.status);

  return (
    <li className="rounded-card bg-white p-4 shadow-sm ring-1 ring-line">
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="block w-full text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONE_CLASSES[status.tone]}`}>
            {status.label}
          </span>
          <span className="rounded-full bg-nicchyo-base px-2 py-0.5 text-xs text-nicchyo-ink/70">
            {TOPIC_LABELS[inquiry.topic].label}
          </span>
          <span className="rounded-full bg-nicchyo-base px-2 py-0.5 text-xs text-nicchyo-ink/70">
            宛先: {CATEGORY_LABELS[inquiry.category]}
          </span>
          {inquiry.urgency === "high" ? (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
              {URGENCY_LABELS.high.label}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm font-medium text-nicchyo-ink">
          {inquiry.shop_name ?? (inquiry.vendor_id ? "店名未設定の出店者" : "出店者なし")}
        </p>
        <p className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed text-nicchyo-ink/80 ${expanded ? "" : "line-clamp-3"}`}>
          {inquiry.body}
        </p>
        <p className="mt-2 text-xs text-nicchyo-ink/40">{formatDateTime(inquiry.created_at)}</p>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          {safeImageUrl ? (
            <a
              href={safeImageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-amber-700 underline"
            >
              添付された画像を開く
            </a>
          ) : null}

          {detailLoading ? (
            <p className="text-xs text-nicchyo-ink/40">やり取りを読み込み中...</p>
          ) : replies.length > 0 ? (
            <ul className="space-y-2">
              {replies.map((reply) => (
                <li
                  key={reply.id}
                  className={`rounded-btn px-3 py-2 text-sm ${
                    reply.sender_role === "vendor" ? "bg-nicchyo-base" : "bg-emerald-50"
                  }`}
                >
                  <p className="text-[11px] font-semibold text-nicchyo-ink/55">
                    {REPLY_ROLE_LABELS[reply.sender_role]} ・ {formatDateTime(reply.created_at)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-nicchyo-ink">{reply.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-nicchyo-ink/40">まだ返信はありません</p>
          )}

          <div className="space-y-2">
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={3}
              maxLength={VENDOR_INQUIRY_REPLY_BODY_MAX_LENGTH}
              placeholder="出店者への返信"
              className="w-full rounded-btn border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={replyAs}
                onChange={(e) => setReplyAs(e.target.value as "operator" | "city")}
                className="rounded-btn border border-line bg-white px-2 py-1.5 text-xs text-nicchyo-ink"
                aria-label="返信の名義"
              >
                <option value="operator">nicchyo運営として返信</option>
                <option value="city">高知市役所の代理として返信</option>
              </select>
              <button
                type="button"
                onClick={() => void sendReply()}
                disabled={busy || !replyBody.trim()}
                className="rounded-btn bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                返信する
              </button>
              {actions.map((action) => (
                <button
                  key={action.status}
                  type="button"
                  onClick={() => void changeStatus(action.status)}
                  disabled={busy}
                  className="rounded-btn bg-nicchyo-base px-3 py-1.5 text-xs font-semibold text-nicchyo-ink ring-1 ring-line disabled:opacity-40"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}
