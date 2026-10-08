"use client";

import { PageContainer, PageShell, PageTitle, Surface } from "@/components/ui";

export default function MyShopContentsPage() {
  return (
    <PageShell bottomNav={false}>
      <PageTitle title="最新情報の発信" />
      <PageContainer>
        <Surface>
          <p className="text-sm text-nicchyo-ink/70">
            ここに最新情報の投稿フォームを追加予定です。
          </p>
        </Surface>
      </PageContainer>
    </PageShell>
  );
}
