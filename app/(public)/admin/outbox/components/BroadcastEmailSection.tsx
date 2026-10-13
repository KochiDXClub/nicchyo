"use client";

import { useCallback, useState } from "react";
import { LoadingButton } from "@/components/admin";
import { showToast } from "@/lib/admin/toast";
import { BROADCAST_TEMPLATES } from "@/lib/email/broadcastTemplates";

type RecipientMode = "all" | "vendor" | "general_user" | "moderator" | "custom";

const RECIPIENT_MODE_LABELS: Record<RecipientMode, string> = {
  all: "全員",
  vendor: "出店者のみ",
  general_user: "一般ユーザーのみ",
  moderator: "モデレーターのみ",
  custom: "個別指定",
};

export function BroadcastEmailSection() {
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("all");
  const [customEmailsText, setCustomEmailsText] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const applyTemplate = useCallback((templateId: string) => {
    const template = BROADCAST_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setSelectedTemplateId(template.id);
    setSubject(template.subject);
    setBody(template.body);
  }, []);

  const handleBlank = useCallback(() => {
    setSelectedTemplateId(null);
    setSubject("");
    setBody("");
  }, []);

  const handleSend = useCallback(async () => {
    if (!subject.trim() || !body.trim()) {
      showToast.error("件名と本文を入力してください");
      return;
    }

    const customEmails =
      recipientMode === "custom"
        ? customEmailsText
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    if (recipientMode === "custom" && (!customEmails || customEmails.length === 0)) {
      showToast.error("送信先メールアドレスを入力してください");
      return;
    }

    const targetLabel =
      recipientMode === "custom"
        ? `指定した${customEmails?.length ?? 0}件`
        : RECIPIENT_MODE_LABELS[recipientMode];
    if (!window.confirm(`${targetLabel}へメールを送信します。よろしいですか？`)) {
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch("/api/admin/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientMode, customEmails, subject, body }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        sentCount?: number;
        failedCount?: number;
        totalCount?: number;
        skipped?: boolean;
      };
      if (!res.ok || !data.ok) {
        showToast.error(data.error ?? "送信に失敗しました");
        return;
      }
      if (data.skipped) {
        showToast.success(`メール送信サービス未設定のため送信をスキップしました（対象${data.totalCount}件）`);
      } else if (data.failedCount && data.failedCount > 0) {
        showToast.error(`${data.sentCount}件送信、${data.failedCount}件失敗しました`);
      } else {
        showToast.success(`${data.sentCount}件へ送信しました`);
      }
    } catch {
      showToast.error("通信エラーが発生しました");
    } finally {
      setIsSending(false);
    }
  }, [recipientMode, customEmailsText, subject, body]);

  return (
    <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-800">メールを送る</h2>
      <p className="mt-1 text-xs text-slate-400">登録ユーザーのメールアドレス宛にお知らせメールを送信します。</p>

      {/* テンプレート選択 */}
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-slate-700">テンプレート</p>
        <div className="flex flex-wrap gap-2">
          {BROADCAST_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                selectedTemplateId === t.id
                  ? "border-orange-500 bg-orange-50 text-orange-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBlank}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              selectedTemplateId === null
                ? "border-orange-500 bg-orange-50 text-orange-700"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            白紙から作成
          </button>
        </div>
      </div>

      {/* 送信対象 */}
      <div className="mt-4">
        <label htmlFor="recipientMode" className="mb-2 block text-sm font-medium text-slate-700">
          送信対象
        </label>
        <select
          id="recipientMode"
          value={recipientMode}
          onChange={(e) => setRecipientMode(e.target.value as RecipientMode)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none sm:w-64"
        >
          {(Object.keys(RECIPIENT_MODE_LABELS) as RecipientMode[]).map((mode) => (
            <option key={mode} value={mode}>
              {RECIPIENT_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
        {recipientMode === "custom" && (
          <textarea
            value={customEmailsText}
            onChange={(e) => setCustomEmailsText(e.target.value)}
            placeholder="メールアドレスをカンマまたは改行区切りで入力"
            rows={3}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
          />
        )}
      </div>

      {/* 件名・本文 */}
      <div className="mt-4">
        <label htmlFor="broadcastSubject" className="mb-2 block text-sm font-medium text-slate-700">
          件名
        </label>
        <input
          id="broadcastSubject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
        />
      </div>
      <div className="mt-4">
        <label htmlFor="broadcastBody" className="mb-2 block text-sm font-medium text-slate-700">
          本文
        </label>
        <textarea
          id="broadcastBody"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
        />
      </div>

      <div className="mt-4 flex justify-end">
        <LoadingButton
          isLoading={isSending}
          loadingText="送信中..."
          onClick={() => void handleSend()}
          className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
        >
          送信する
        </LoadingButton>
      </div>
    </section>
  );
}
