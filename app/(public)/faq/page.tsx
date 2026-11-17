import NavigationBar from "../../components/NavigationBar";
import { PageContainer, PageShell } from "@/components/ui";
import { siteTextFor } from "@/lib/siteCopy";
import { getLocale } from "@/lib/i18n/server";
import { getPublishedSiteCopy } from "@/lib/site-copy/server";
import FaqClient from "./FaqClient";

export async function generateMetadata() {
  const [locale, copy] = await Promise.all([getLocale(), getPublishedSiteCopy()]);
  return {
    title: siteTextFor("faq.title", locale, copy.texts),
    description: siteTextFor("faq.description", locale, copy.texts),
  };
}

export default async function FAQPage() {
  const [locale, copy] = await Promise.all([getLocale(), getPublishedSiteCopy()]);
  return (
    <PageShell as="main">
      {/* 見出しの帯。地から中身に移る手前に主色を薄く敷いて、視線の入口を作る */}
      <div className="bg-gradient-to-b from-amber-100/50 to-transparent pb-6 pt-safe-top">
        <PageContainer width="narrow" className="pt-6">
          <h1 className="text-2xl font-bold tracking-tight">{siteTextFor("faq.title", locale, copy.texts)}</h1>
        </PageContainer>
      </div>

      <PageContainer width="narrow">
        <FaqClient faq={copy.faq} />
      </PageContainer>

      <NavigationBar />
    </PageShell>
  );
}
