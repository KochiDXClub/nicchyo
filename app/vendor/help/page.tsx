import { PageContainer, PageShell, PageTitle } from "@/components/ui";
import VendorFaqClient from "./VendorFaqClient";

export const metadata = { title: "よくある質問" };

export default function VendorHelpPage() {
  return (
    <PageShell bottomNav={false}>
      <PageTitle title="よくある質問" />

      <PageContainer width="narrow">
        <VendorFaqClient />
      </PageContainer>
    </PageShell>
  );
}
