import Link from "next/link";
import { PageContainer, PageShell } from "@/components/ui";
import SiteGuideBackLink from "@/app/components/SiteGuideBackLink";
import NavigationBar from "../../components/NavigationBar";
import ContactForm from "./ContactForm";

export const metadata = {
  title: "お問い合わせ・掲載情報の訂正",
  description: "店舗・開催情報の訂正、ご意見、不具合のご連絡をnicchyoの運営チームに送れます。",
};

export default function ContactPage() {
  return (
    <PageShell as="main" topNav>
      <PageContainer width="reading" className="space-y-6 pt-[calc(var(--safe-top,0px)+1rem)]">
        <SiteGuideBackLink />
        <header>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">お問い合わせ・掲載情報の訂正</h1>
          <p className="mt-3 text-sm leading-relaxed text-nicchyo-ink/75">
            日曜市の店舗・開催情報の訂正、ご意見や不具合を、nicchyoの運営チームにお知らせいただけます。
          </p>
        </header>
        <section id="corrections" aria-labelledby="correction-title" className="scroll-mt-6 rounded-card bg-nicchyo-soft-green/25 p-5 ring-1 ring-line">
          <h2 id="correction-title" className="font-bold">掲載情報の訂正を送るとき</h2>
          <p className="mt-2 text-sm leading-relaxed text-nicchyo-ink/75">
            お店の名前や開催日、該当ページのURL、訂正したい内容を分かる範囲でお書きください。
          </p>
        </section>
        <section aria-labelledby="contact-form-title" className="rounded-card bg-white p-5 ring-1 ring-line sm:p-7">
          <h2 id="contact-form-title" className="mb-5 text-lg font-bold">お問い合わせフォーム</h2>
          <ContactForm />
        </section>
        <Link href="/faq" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">よくある質問を見る</Link>
      </PageContainer>
      <NavigationBar backBarOnTop />
    </PageShell>
  );
}
