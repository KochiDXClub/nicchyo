import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PageContainer, PageShell } from "@/components/ui";
import { getLocale } from "@/lib/i18n/server";
import { GITHUB_REPO_URL } from "@/lib/siteLinks";

const copy = {
  ja: {
    title: "このサイトの運営とデータ",
    description: "nicchyoの運営主体、情報の訂正窓口、アクセス解析の設定をご案内します。",
    back: "トップへ戻る",
    questions: [
      {
        title: "誰が運営していますか？",
        body: "高知高専のnicchyoプロジェクトが、日曜市のデジタルマップを開発・運営しています。",
        link: "nicchyoについて",
        href: "/about",
      },
      {
        title: "掲載情報が違っていたら？",
        body: "お問い合わせフォームからお知らせください。お店の名前や該当ページ、どこが違っていたかを添えていただけると確認しやすくなります。",
        link: "情報の訂正を知らせる",
        href: "/contact",
      },
      {
        title: "アクセス解析を止めるには？",
        body: "プライバシーポリシーのスイッチで、いつでも切り替えられます。設定はこのブラウザに保存されます。",
        link: "アクセス解析の設定へ",
        href: "/privacy#analytics-settings",
      },
    ],
    more: "もっと詳しく",
    links: [
      { label: "データの扱いと保存期間", href: "/privacy" },
      { label: "日曜市の開催情報", href: "/calendar" },
      { label: "サイトの更新履歴", href: "/about/versions" },
      { label: "公開ソースコード（GitHub）", href: GITHUB_REPO_URL },
    ],
  },
  en: {
    title: "Site team and data",
    description: "Find out who runs nicchyo, how to report incorrect information, and how to turn off analytics.",
    back: "Back to home",
    questions: [
      {
        title: "Who runs this site?",
        body: "The nicchyo project at Kochi Kosen builds and operates this digital map of the Sunday Market.",
        link: "About nicchyo",
        href: "/about",
      },
      {
        title: "How can I report incorrect information?",
        body: "Use the contact form. The shop name, page, and what you noticed help the team check the information.",
        link: "Report a correction",
        href: "/contact",
      },
      {
        title: "How do I turn off analytics?",
        body: "You can change this setting anytime using the switch in the privacy policy. Your choice is saved in this browser.",
        link: "Open analytics settings",
        href: "/privacy#analytics-settings",
      },
    ],
    more: "More information",
    links: [
      { label: "Data use and retention", href: "/privacy" },
      { label: "Sunday Market calendar", href: "/calendar" },
      { label: "Version history", href: "/about/versions" },
      { label: "Source code on GitHub", href: GITHUB_REPO_URL },
    ],
  },
} as const;

const linkClass = "inline-flex min-h-11 items-center gap-2 rounded-btn text-sm font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-nicchyo-primary";

export async function generateMetadata() {
  const { title, description } = copy[await getLocale()];
  return { title, description };
}

export default async function SiteTrustGuidePage() {
  const text = copy[await getLocale()];

  return (
    <PageShell as="main" bottomNav={false}>
      <PageContainer width="reading" className="space-y-6 pt-[calc(var(--safe-top,0px)+1rem)]">
        <Link href="/" className={linkClass}>
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {text.back}
        </Link>

        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{text.title}</h1>

        <div className="divide-y divide-line-warm rounded-card bg-white px-4 ring-1 ring-line sm:px-6">
          {text.questions.map((item) => (
            <section key={item.href} className="py-4">
              <h2 className="font-bold">{item.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-nicchyo-ink/75">{item.body}</p>
              <Link href={item.href} className={linkClass}>
                {item.link}
                <ArrowRight aria-hidden className="h-4 w-4 shrink-0" />
              </Link>
            </section>
          ))}
        </div>

        <nav aria-labelledby="site-more-information">
          <h2 id="site-more-information" className="font-bold">{text.more}</h2>
          <ul className="mt-1 grid sm:grid-cols-2">
            {text.links.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className={linkClass}>{label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </PageContainer>
    </PageShell>
  );
}
