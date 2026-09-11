"use client";

import { useState } from "react";

/**
 * AI の回答への評価（役に立った / 改善が必要）を送る小さな UI。
 *
 * やりとりの中身（質問文・回答文）は既定で送らない。低評価のときに
 * 「このときのやりとりも送る」を選んでいただいた場合だけ添える（#629）。
 *
 * 相談ページ・店舗の相談パネルなど、複数の画面から使う。
 */
export function ConsultFeedback({
  consultId,
  turnIndex = 0,
  questionText,
  answerText,
  tone = "amber",
  className = "",
}: {
  /** この回答を識別する UUID。無いときは評価を出さない */
  consultId: string | undefined;
  /** 同じ相談の中で何番目の回答か */
  turnIndex?: number;
  /** 「やりとりも送る」を選ばれたときにだけ送る質問文 */
  questionText?: string;
  /** 「やりとりも送る」を選ばれたときにだけ送る回答文 */
  answerText?: string;
  /** 画面に合わせた色味 */
  tone?: "amber" | "rose";
  className?: string;
}) {
  const [rated, setRated] = useState(false);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [shareTranscript, setShareTranscript] = useState(false);

  if (!consultId) return null;

  const send = async (rating: 1 | -1, includeTranscript: boolean) => {
    setRated(true);
    setOpen(false);
    try {
      await fetch("/api/grandma/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultId,
          turnIndex,
          rating,
          comment: rating === -1 && comment.trim() ? comment.trim() : null,
          questionText: includeTranscript ? questionText : undefined,
          turnText: includeTranscript ? answerText : undefined,
        }),
      });
    } catch {
      // 送れなくても会話の邪魔をしない
    }
  };

  const accent =
    tone === "rose"
      ? { border: "border-rose-200", bg: "bg-rose-50", text: "text-rose-600", hover: "hover:bg-rose-100", ring: "focus:ring-rose-300", check: "text-rose-500" }
      : { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-700", hover: "hover:bg-amber-100", ring: "focus:ring-amber-300", check: "text-amber-500" };

  if (rated) {
    return (
      <p className={`text-right text-[11px] text-slate-400 ${className}`}>
        ありがとうございました
      </p>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-end gap-1">
        <span className="mr-1 text-[11px] text-slate-400">この答えはどうでしたか？</span>
        <button
          type="button"
          onClick={() => void send(1, false)}
          className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-nicchyo-primary"
          aria-label="役に立った"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M1 8.25a1.25 1.25 0 1 1 2.5 0v7.5a1.25 1.25 0 0 1-2.5 0v-7.5ZM11 3V1.7c0-.268.14-.526.395-.607A2 2 0 0 1 14 3c0 .995-.182 1.948-.514 2.826-.204.54.166 1.174.744 1.174h2.52c1.243 0 2.261 1.01 2.146 2.247a23.9 23.9 0 0 1-1.341 5.974C17.153 16.323 16.072 17 14.9 17h-3.192a3 3 0 0 1-1.341-.317l-2.734-1.366A3 3 0 0 0 6.292 15H5V8h.963c.685 0 1.258-.483 1.612-1.068a4.011 4.011 0 0 0 .166-.281l.531-1.06a2 2 0 0 1 .911-.93l1.55-.775A1 1 0 0 1 11 5v.818L10.036 8H11c.552 0 1 .448 1 1v-5.182L11 3Z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`rounded-full p-1.5 transition hover:bg-slate-100 ${open ? accent.text : "text-slate-400 hover:text-rose-400"}`}
          aria-label="改善が必要"
          aria-expanded={open}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M18.905 12.75a1.25 1.25 0 0 1-2.5 0v-7.5a1.25 1.25 0 0 1 2.5 0v7.5ZM8.905 17v1.3c0 .268-.14.526-.395.607A2 2 0 0 1 5.905 17c0-.995.182-1.948.514-2.826.204-.54-.166-1.174-.744-1.174h-2.52c-1.243 0-2.261-1.01-2.146-2.247a23.9 23.9 0 0 1 1.341-5.974C2.752 3.677 3.833 3 5.005 3h3.192a3 3 0 0 1 1.341.317l2.734 1.366A3 3 0 0 0 13.613 5h1.292v7h-.963c-.685 0-1.258.483-1.612 1.068a4.01 4.01 0 0 0-.166.281l-.531 1.06a2 2 0 0 1-.911.93l-1.55.775A1 1 0 0 1 8.905 15v-.818l.964-2.182H8.905a1 1 0 0 1-1-1V17Z" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="mt-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send(-1, shareTranscript);
              }}
              placeholder="改善点を教えてください（任意）"
              maxLength={200}
              className={`h-9 flex-1 rounded-full border ${accent.border} bg-white px-3 text-[12px] text-slate-700 placeholder:text-slate-300 outline-none focus:border-slate-300`}
            />
            <button
              type="button"
              onClick={() => void send(-1, shareTranscript)}
              className={`shrink-0 rounded-full border ${accent.border} ${accent.bg} px-3 py-1.5 text-[12px] font-bold ${accent.text} ${accent.hover}`}
            >
              送信
            </button>
          </div>
          {/* やりとりの中身は既定で送らない。選んでいただいたときだけ添える（#629） */}
          <label className="flex cursor-pointer items-center gap-1.5 py-1 text-[11px] text-slate-500">
            <input
              type="checkbox"
              checked={shareTranscript}
              onChange={(e) => setShareTranscript(e.target.checked)}
              className={`h-3.5 w-3.5 rounded border-slate-300 ${accent.check} ${accent.ring}`}
            />
            このときのやりとりも送る（改善に使わせていただきます）
          </label>
        </div>
      )}
    </div>
  );
}
