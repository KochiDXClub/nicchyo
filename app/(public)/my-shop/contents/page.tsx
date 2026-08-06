"use client";

import Link from "next/link";

export default function MyShopContentsPage() {
  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-800">
      <div className="mx-auto w-full max-w-2xl px-4 pt-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">最新情報の発信</h1>
          <p className="mt-3 text-sm text-slate-600">
            ここに最新情報の投稿フォームを追加予定です。
          </p>
          <Link
            href="/my-shop"
            className="mt-6 inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            出店者メニューへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
