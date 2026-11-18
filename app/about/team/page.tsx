import Image from "next/image";
import Link from "next/link";
import SiteGuideBackLink from "@/app/components/SiteGuideBackLink";
import { PageContainer, PageShell } from "@/components/ui";
import { GITHUB_REPO_URL } from "@/lib/siteLinks";

export const metadata = {
  title: "nicchyoの運営チーム",
  description: "高知・日曜市のデジタルマップ nicchyo を運営する高知高専の学生プロジェクトについて。",
};

const links = [
  { href: "/activities", text: "現地調査や発表の活動記録" },
  { href: "/about", text: "スライドで見る nicchyo の紹介" },
  { href: GITHUB_REPO_URL, text: "公開ソースコード（GitHub）" },
  { href: "/contact", text: "運営チームへのお問い合わせ" },
];

export default function SiteTeamPage() {
  return (
    <PageShell as="main" bottomNav={false}>
      <PageContainer width="reading" className="space-y-7 pt-[calc(var(--safe-top,0px)+1rem)]">
        <SiteGuideBackLink />
        <header>
          <h1 className="text-3xl font-black tracking-tight">nicchyoの運営チーム</h1>
          <p className="mt-3 leading-relaxed text-nicchyo-ink/75">
            高知高専の学生が中心となり、高知・日曜市を歩く人のためにデジタルマップを開発・運営しています。
          </p>
        </header>
        <figure>
          <Image
            src="/images/activities/2025-10-19-sunday-market-survey.webp"
            alt="日曜市の会場で調査するnicchyoのメンバー"
            width={2344}
            height={1758}
            sizes="(min-width: 640px) 36rem, 100vw"
            className="aspect-video w-full rounded-card object-cover"
          />
          <figcaption className="mt-2 text-sm text-nicchyo-ink/70">日曜市での来場者・出店者調査（2025年10月）</figcaption>
        </figure>
        <section aria-labelledby="team-role" className="rounded-card bg-white p-5 ring-1 ring-line sm:p-6">
          <h2 id="team-role" className="text-lg font-bold">チームの役割</h2>
          <dl className="mt-3 space-y-4 text-sm leading-relaxed">
            <div>
              <dt className="font-bold">サイトの運営</dt>
              <dd className="mt-1 text-nicchyo-ink/75">高知高専 nicchyo プロジェクトが、企画・開発・現地調査・サイトの運営を担当します。</dd>
            </div>
            <div>
              <dt className="font-bold">地域との協力</dt>
              <dd className="mt-1 text-nicchyo-ink/75">日曜市の案内を改善するため、高知市の街路市担当への聞き取りや、来場者・出店者へのアンケートを行いました。</dd>
            </div>
          </dl>
        </section>
        <nav aria-label="活動とお問い合わせ">
          <ul className="grid sm:grid-cols-2">
            {links.map(({ href, text }) => (
              <li key={href}>
                <Link href={href} className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">{text}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </PageContainer>
    </PageShell>
  );
}
