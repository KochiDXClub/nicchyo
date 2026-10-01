"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import ClosedDaysCalendar from "@/components/vendor/ClosedDaysCalendar";
import { PageContainer, PageShell, PageTitle, Surface } from "@/components/ui";

export default function MyShopSchedulePage() {
  const { user } = useAuth();

  return (
    <PageShell bottomNav={false}>
      <PageTitle title="出店予定の管理" />
      <PageContainer className="space-y-4">
        <p className="text-[15px] leading-relaxed text-nicchyo-ink/70">
          お休みする日を登録しておくと、お客さんに正しく伝わります。
        </p>

        {user?.id ? (
          <ClosedDaysCalendar vendorId={user.id} variant="full" />
        ) : (
          <Surface className="text-nicchyo-ink/55">読み込み中です…</Surface>
        )}
      </PageContainer>
    </PageShell>
  );
}
