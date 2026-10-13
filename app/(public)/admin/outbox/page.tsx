"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader } from "@/components/admin";
import { AdminTabs, type AdminTab } from "@/components/admin/AdminTabs";
import { SiteAnnouncementSection } from "./components/SiteAnnouncementSection";
import { BroadcastEmailSection } from "./components/BroadcastEmailSection";
import { VendorNoticeSection } from "./components/VendorNoticeSection";

type OutboxTabKey = "site" | "vendor" | "email";

/** 送る相手・手段ごとのタブ。縦に並べず、1つずつ開く */
const OUTBOX_TABS: readonly AdminTab<OutboxTabKey>[] = [
  { key: "site", label: "サイト内のお知らせ" },
  { key: "vendor", label: "出店者へのお知らせ" },
  { key: "email", label: "お知らせメール" },
];

function isOutboxTabKey(value: string | null): value is OutboxTabKey {
  return OUTBOX_TABS.some((tab) => tab.key === value);
}

/**
 * お知らせ（送信）。運営から出店者・登録ユーザーへ送るものをここにまとめる。
 * 届いたもの（通知・通報・問い合わせ）を確認する「受信トレイ」とは分けている。
 */
export default function OutboxPage() {
  const { permissions, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<OutboxTabKey>("site");

  useEffect(() => {
    if (authLoading) return;
    if (!permissions.isAdmin) router.push("/");
  }, [authLoading, permissions.isAdmin, router]);

  // ?tab=email のように、開きたいタブへ直接リンクできるようにする
  useEffect(() => {
    const requested = searchParams.get("tab");
    if (isOutboxTabKey(requested)) setTab(requested);
  }, [searchParams]);

  const handleTabChange = (next: OutboxTabKey) => {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`/admin/outbox?${params.toString()}`, { scroll: false });
  };

  if (authLoading || !permissions.isAdmin) return null;

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="お知らせ"
        title="お知らせを送る"
        description="サイト内のお知らせの投稿、出店者へのお知らせ、登録ユーザーへのお知らせメールを送ります。届いたものの確認は「受信トレイ」で行います。"
      />
      <AdminTabs tabs={OUTBOX_TABS} value={tab} onChange={handleTabChange} ariaLabel="お知らせの送り先" />
      <div className="mx-auto max-w-3xl px-4 py-8 pb-20">
        {tab === "site" && <SiteAnnouncementSection />}
        {tab === "vendor" && <VendorNoticeSection />}
        {tab === "email" && <BroadcastEmailSection />}
      </div>
    </AdminLayout>
  );
}
