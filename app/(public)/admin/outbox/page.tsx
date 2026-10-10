"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader } from "@/components/admin";
import { BroadcastEmailSection } from "./components/BroadcastEmailSection";
import { VendorNoticeSection } from "./components/VendorNoticeSection";

/**
 * お知らせ（送信）。運営から出店者・登録ユーザーへ送るものをここにまとめる。
 * 届いたもの（通知・通報・問い合わせ）を確認する「受信トレイ」とは分けている。
 */
export default function OutboxPage() {
  const { permissions, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!permissions.isAdmin) router.push("/");
  }, [authLoading, permissions.isAdmin, router]);

  if (authLoading || !permissions.isAdmin) return null;

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="お知らせ"
        title="お知らせを送る"
        description="出店者へのお知らせと、登録ユーザーへのお知らせメールを送ります。届いたものの確認は「受信トレイ」で行います。"
      />
      <div className="mx-auto max-w-3xl px-4 py-8 pb-20">
        <VendorNoticeSection />
        <BroadcastEmailSection />
      </div>
    </AdminLayout>
  );
}
