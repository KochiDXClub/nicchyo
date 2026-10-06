"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader, ErrorBoundary } from "@/components/admin";
import { FieldShopEditor } from "../components/FieldShopEditor";

function FieldEditContent() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isAdmin) router.push("/");
  }, [isLoading, permissions.isAdmin, router]);

  if (isLoading || !permissions.isAdmin || !id) return null;

  return (
    <AdminLayout withBottomPadding={false}>
      <AdminPageHeader eyebrow="Field" title="店舗の登録" description="聞いた内容をその場で入力して保存します" />
      <div className="mx-auto max-w-2xl px-4 py-4">
        <FieldShopEditor shopId={id} />
      </div>
    </AdminLayout>
  );
}

export default function AdminFieldEditPage() {
  return (
    <ErrorBoundary>
      <FieldEditContent />
    </ErrorBoundary>
  );
}
