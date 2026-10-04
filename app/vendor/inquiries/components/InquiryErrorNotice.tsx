"use client";

import Link from "next/link";

type Props = {
  message: string;
  /** ログインの有効期限切れ（401）のときだけ、ログインへの導線を足す */
  needsLogin?: boolean;
};

/** 連絡画面のエラー表示。3つの画面（一覧・詳細・新規）で同じ見た目にそろえる */
export default function InquiryErrorNotice({ message, needsLogin = false }: Props) {
  return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {message}
      {needsLogin && (
        <Link href="/login" className="mt-2 block font-bold underline">
          ログインし直す
        </Link>
      )}
    </div>
  );
}
