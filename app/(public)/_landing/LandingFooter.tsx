import Link from "next/link";
import { PageContainer } from "@/components/ui";
import type { Locale } from "@/lib/i18n/config";

const links = [
  { href: "/about", ja: "nicchyoについて", en: "About nicchyo" },
  { href: "/privacy", ja: "プライバシーポリシー", en: "Privacy policy" },
  { href: "/about/versions", ja: "更新履歴", en: "Version history" },
  { href: "/contact", ja: "お問い合わせ・情報の訂正", en: "Contact and corrections" },
] as const;

export default function LandingFooter({ locale }: { locale: Locale }) {
  const english = locale === "en";

  return (
    <footer className="mt-16 border-t border-line-warm py-7 md:mt-24">
      <PageContainer width="wide" className="space-y-3">
        <div>
          <h2 id="landing-footer-title" className="text-base font-bold">
            <Link href="/about/site" className="inline-flex min-h-11 items-center rounded-btn underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-nicchyo-primary">
              {english ? "Site team and data" : "このサイトの運営とデータ"}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-nicchyo-ink/75">
            {english ? "Operated by the nicchyo project at Kochi Kosen." : "運営：高知高専 nicchyo プロジェクト"}
          </p>
        </div>
        <nav aria-labelledby="landing-footer-title">
          <ul className="flex flex-wrap gap-x-6">
            {links.map(({ href, ja, en }) => (
              <li key={href}>
                <Link href={href} className="inline-flex min-h-11 items-center rounded-btn text-sm font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-nicchyo-primary">
                  {english ? en : ja}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </PageContainer>
    </footer>
  );
}
