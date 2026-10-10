"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Surface } from "@/components/ui";
import { showToast } from "@/lib/admin/toast";
import {
  NOTICE_BODY_MAX,
  NOTICE_SENDER_LABELS,
  NOTICE_SENDERS,
  NOTICE_TITLE_MAX,
  type Notice,
  type NoticeSender,
} from "@/lib/vendor/notices";

type AdminNotice = Notice & { readCount: number };

const fieldClass =
  "w-full rounded-btn border border-line bg-white px-3 py-2 text-sm text-nicchyo-ink focus:border-amber-400 focus:outline-none";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? fallback;
}

/**
 * 出店者へのお知らせ。出店者ページ（連絡）に届き、出店者が「確認しました」を押すと数が増える。
 * メールと違ってアドレスの無い出店者にも届く。
 */
export function VendorNoticeSection() {
  const [notices, setNotices] = useState<AdminNotice[] | null>(null);
  const [sender, setSender] = useState<NoticeSender>("city");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [important, setImportant] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/vendor-notices");
    if (!res.ok) {
      showToast.error(await readError(res, "お知らせを読み込めませんでした"));
      setNotices([]);
      return;
    }
    const data = (await res.json()) as { notices: AdminNotice[] };
    setNotices(data.notices);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async () => {
    if (!title.trim() || !body.trim()) {
      showToast.error("見出しと本文を入れてください");
      return;
    }
    if (!window.confirm(`「${NOTICE_SENDER_LABELS[sender]}」として全出店者に出します。よろしいですか？`)) return;

    setPosting(true);
    try {
      const res = await fetch("/api/admin/vendor-notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender, title, body, important }),
      });
      if (!res.ok) {
        showToast.error(await readError(res, "出せませんでした"));
        return;
      }
      const data = (await res.json()) as { notice: AdminNotice };
      setNotices((prev) => [data.notice, ...(prev ?? [])]);
      setTitle("");
      setBody("");
      setImportant(false);
      showToast.success("出店者にお知らせを出しました");
    } catch {
      showToast.error("通信エラーが発生しました");
    } finally {
      setPosting(false);
    }
  };

  const withdraw = async (notice: AdminNotice) => {
    if (!window.confirm(`「${notice.title}」を取り下げます。出店者の画面から消えます。よろしいですか？`)) return;
    const res = await fetch(`/api/admin/vendor-notices/${notice.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      showToast.error(res ? await readError(res, "取り下げられませんでした") : "通信エラーが発生しました");
      return;
    }
    setNotices((prev) => prev?.filter((n) => n.id !== notice.id) ?? null);
    showToast.success("取り下げました");
  };

  return (
    <Surface className="mb-8">
      <h2 className="text-lg font-bold text-nicchyo-ink">出店者へのお知らせ</h2>
      <p className="mt-1 text-xs text-nicchyo-ink/55">
        全出店者の「連絡」画面に届き、出店者ページでも知らせます。出店者が「確認しました」を押すと数が増えます。
      </p>

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium text-nicchyo-ink">差出人</legend>
        <div className="flex gap-2">
          {NOTICE_SENDERS.map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-chip border px-3 py-1.5 text-xs font-medium transition ${
                sender === value ? "border-amber-500 bg-amber-50 text-amber-800" : "border-line text-nicchyo-ink/70"
              }`}
            >
              <input
                type="radio"
                name="noticeSender"
                value={value}
                checked={sender === value}
                onChange={() => setSender(value)}
                className="sr-only"
              />
              {NOTICE_SENDER_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4">
        <label htmlFor="noticeTitle" className="mb-2 block text-sm font-medium text-nicchyo-ink">
          見出し
        </label>
        <input
          id="noticeTitle"
          type="text"
          value={title}
          maxLength={NOTICE_TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例：10月12日は区画の配置が変わります"
          className={fieldClass}
        />
      </div>
      <div className="mt-4">
        <label htmlFor="noticeBody" className="mb-2 block text-sm font-medium text-nicchyo-ink">
          本文
        </label>
        <textarea
          id="noticeBody"
          value={body}
          maxLength={NOTICE_BODY_MAX}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className={fieldClass}
        />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-nicchyo-ink">
        <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
        大事なお知らせ（開催中止・区画の変更など。出店者ページで目立たせます）
      </label>

      <div className="mt-4 flex justify-end">
        <Button onClick={() => void post()} disabled={posting}>
          {posting ? "出しています..." : "全出店者に出す"}
        </Button>
      </div>

      <h3 className="mt-8 text-sm font-bold text-nicchyo-ink">出したお知らせ</h3>
      {notices === null ? (
        <p className="mt-2 text-sm text-nicchyo-ink/55">読み込み中...</p>
      ) : notices.length === 0 ? (
        <p className="mt-2 text-sm text-nicchyo-ink/55">まだありません</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {notices.map((notice) => (
            <li key={notice.id} className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-nicchyo-ink">
                  {notice.important && <Badge variant="caution">大事</Badge>}
                  {notice.title}
                </p>
                <p className="mt-0.5 text-xs text-nicchyo-ink/55">
                  {NOTICE_SENDER_LABELS[notice.sender]}・{formatDate(notice.createdAt)}・確認 {notice.readCount} 店
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void withdraw(notice)}>
                取り下げる
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
