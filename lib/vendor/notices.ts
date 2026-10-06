import { z } from "zod";

/**
 * 運営・市役所から出店者へのお知らせ。
 * 保存先は vendor_notices（supabase/migrations/20261001180000_create_vendor_notices.sql）。
 * 値域はテーブルの CHECK 制約とそろえること。
 */

export const NOTICE_SENDERS = ["city", "operator"] as const;
export type NoticeSender = (typeof NOTICE_SENDERS)[number];

export const NOTICE_SENDER_LABELS: Record<NoticeSender, string> = {
  city: "高知市から",
  operator: "運営から",
};

export const NOTICE_TITLE_MAX = 80;
export const NOTICE_BODY_MAX = 2000;

/** 出店者に見せる件数。古いお知らせは出さない */
export const NOTICE_LIST_LIMIT = 30;

export const NoticeInputSchema = z.object({
  sender: z.enum(NOTICE_SENDERS),
  title: z.string().trim().min(1, "見出しを入れてください").max(NOTICE_TITLE_MAX, `見出しは${NOTICE_TITLE_MAX}文字以内です`),
  body: z.string().trim().min(1, "本文を入れてください").max(NOTICE_BODY_MAX, `本文は${NOTICE_BODY_MAX}文字以内です`),
  important: z.boolean(),
});

export type NoticeInput = z.infer<typeof NoticeInputSchema>;

export type Notice = {
  id: string;
  sender: NoticeSender;
  title: string;
  body: string;
  /** 大事なお知らせ（開催中止・区画の変更など）。出店者ページで目立たせる */
  important: boolean;
  createdAt: string;
};

export type NoticeRow = {
  id: string;
  sender: NoticeSender;
  title: string;
  body: string;
  important: boolean;
  created_at: string;
};

export const NOTICE_COLUMNS = "id, sender, title, body, important, created_at";

export function rowToNotice(row: NoticeRow): Notice {
  return {
    id: row.id,
    sender: row.sender,
    title: row.title,
    body: row.body,
    important: row.important,
    createdAt: row.created_at,
  };
}
