"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader, EmptyState } from "@/components/admin";
import { showToast } from "@/lib/admin/toast";
import type { Inquiry, InquiryStatus } from "@/app/api/admin/inquiries/route";

const STATUS_LABELS: Record<InquiryStatus, string> = {
  open: "未対応",
  in_progress: "対応中",
  resolved: "解決済み",
  closed: "クローズ",
};

const STATUS_COLORS: Record<InquiryStatus, string> = {
  open: "bg-red-100 text-red-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-600",
};

const CATEGORY_LABELS: Record<string, string> = {
  question: "ご質問",
  feedback: "ご意見",
  bug: "不具合・トラブル",
  other: "その他",
};

export default function AdminInquiriesPage() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | "all">("open");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [replyNotes, setReplyNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.canModerateContent) {
      router.push("/");
    }
  }, [isLoading, permissions.canModerateContent, router]);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      const res = await fetch(`/api/admin/inquiries?${params.toString()}`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json() as { inquiries: Inquiry[] };
      setInquiries(data.inquiries);
    } catch {
      showToast.error("問い合わせデータの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    if (!permissions.canModerateContent) return;
    void fetchInquiries();
  }, [fetchInquiries, permissions.canModerateContent]);

  const handleStatusChange = async (inquiry: Inquiry, newStatus: InquiryStatus) => {
    setUpdating(true);
    try {
      const res = await fetch("/api/admin/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: inquiry.id,
          status: newStatus,
          reply_notes: replyNotes || undefined,
        }),
      });
      if (!res.ok) throw new Error("failed");
      showToast.success(`ステータスを「${STATUS_LABELS[newStatus]}」に変更しました`);
      setSelectedInquiry(null);
      setReplyNotes("");
      void fetchInquiries();
    } catch {
      showToast.error("ステータス更新に失敗しました");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="サポート"
        title="問い合わせ管理"
      />

      {/* フィルター */}
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InquiryStatus | "all")}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
        >
          <option value="all">すべてのステータス</option>
          {(Object.entries(STATUS_LABELS) as [InquiryStatus, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
        >
          <option value="all">すべてのカテゴリ</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* 問い合わせ一覧 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">読み込み中...</div>
      ) : inquiries.length === 0 ? (
        <EmptyState title="該当する問い合わせはありません" />
      ) : (
        <div className="space-y-3">
          {inquiries.map((inquiry) => (
            <div
              key={inquiry.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[inquiry.status]}`}>
                      {STATUS_LABELS[inquiry.status]}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {CATEGORY_LABELS[inquiry.category] ?? inquiry.category}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">
                      {inquiry.name ?? "匿名"}
                    </span>
                    <a
                      href={`mailto:${inquiry.email}`}
                      className="text-xs text-amber-700 hover:underline"
                    >
                      {inquiry.email}
                    </a>
                  </div>

                  <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {inquiry.message}
                  </p>

                  {inquiry.reply_notes && (
                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      対応メモ: {inquiry.reply_notes}
                    </p>
                  )}

                  <div className="mt-2 text-xs text-slate-400">
                    {new Date(inquiry.created_at).toLocaleString("ja-JP")}
                  </div>
                </div>

                {/* アクションボタン */}
                {(inquiry.status === "open" || inquiry.status === "in_progress") && (
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {inquiry.status === "open" && (
                      <button
                        type="button"
                        onClick={() => void handleStatusChange(inquiry, "in_progress")}
                        disabled={updating}
                        className="rounded-lg bg-yellow-100 px-3 py-1.5 text-xs font-semibold text-yellow-800 hover:bg-yellow-200 disabled:opacity-40"
                      >
                        対応中にする
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setSelectedInquiry(inquiry); setReplyNotes(inquiry.reply_notes ?? ""); }}
                      className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-200"
                    >
                      解決済みにする
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStatusChange(inquiry, "closed")}
                      disabled={updating}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-40"
                    >
                      クローズ
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 解決メモモーダル */}
      {selectedInquiry && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => !updating && setSelectedInquiry(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-slate-900">解決済みにする</h2>
            <p className="mt-1 text-xs text-slate-500">
              {selectedInquiry.name ?? selectedInquiry.email} からの問い合わせを解決済みとしてマークします。
            </p>
            <textarea
              value={replyNotes}
              onChange={(e) => setReplyNotes(e.target.value)}
              placeholder="対応内容メモ（任意）"
              rows={4}
              maxLength={1000}
              className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void handleStatusChange(selectedInquiry, "resolved")}
                disabled={updating}
                className="flex-1 rounded-xl bg-green-600 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {updating ? "処理中..." : "解決済みにする"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                disabled={updating}
                className="flex-1 rounded-xl bg-slate-100 py-2 text-sm font-medium text-slate-700"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
