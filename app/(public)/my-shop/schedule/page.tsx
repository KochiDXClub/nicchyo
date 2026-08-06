"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import ClosedDaysCalendar from "@/components/vendor/ClosedDaysCalendar";

export default function MyShopSchedulePage() {
  const { user } = useAuth();

  return (
    <div
      className="min-h-screen bg-nicchyo-base"
      style={{ paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto w-full max-w-2xl px-4 pt-10">
        <header className="mb-6">
          <p className="eyebrow">Schedule</p>
          <h1 className="mt-2 font-display text-3xl text-nicchyo-ink">出店予定の管理</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
            お休みする日を登録しておくと、お客さんに正しく伝わります。
          </p>
        </header>

        {user?.id ? (
          <ClosedDaysCalendar vendorId={user.id} variant="full" />
        ) : (
          <div className="rounded-panel border border-amber-100 bg-white p-5 text-slate-500 shadow-card">
            読み込み中です…
          </div>
        )}
      </div>
    </div>
  );
}
