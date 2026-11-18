import Link from "next/link";
import { PageContainer } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

const links = [
  { href: "/about", label: "nicchyoについて" },
  { href: "/privacy", label: "プライバシーポリシー" },
  { href: "/about/versions", label: "更新履歴" },
  { href: "/contact", label: "お問い合わせ・情報の訂正" },
] as const;

export default async function LandingFooter() {
  const t = await getT();

  return (
    <footer className="mt-16 border-t border-line-warm py-7 md:mt-24">
      <PageContainer width="wide" className="space-y-3">
        <div>
          <h2 id="landing-footer-title" className="text-base font-bold">
            {t("このサイトの運営とデータ")}
          </h2>
          <p className="mt-1 text-sm text-nicchyo-ink/75">
            {t("運営：高知高専 nicchyo プロジェクト")}
          </p>
        </div>
        <nav aria-labelledby="landing-footer-title">
          <ul className="flex flex-wrap gap-x-6">
            {links.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="inline-flex min-h-11 items-center rounded-btn text-sm font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-nicchyo-primary">
                  {t(label)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </PageContainer>
    </footer>
  );
}
