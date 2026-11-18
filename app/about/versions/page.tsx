import { PageContainer, PageShell, VersionDate } from "@/components/ui";
import SiteGuideBackLink from "@/app/components/SiteGuideBackLink";
import { versionHistory, type VersionEntry } from "../versions";

export const metadata = {
  title: "サイトの更新履歴",
  description: "nicchyoで公開した変更と、一般公開に向けて準備中の変更をご案内します。",
};

export default function VersionHistoryPage() {
  const released = versionHistory.filter((entry) => entry.released !== false);
  const upcoming = versionHistory.filter((entry) => entry.released === false);

  return (
    <PageShell as="main" bottomNav={false}>
      <PageContainer width="reading" className="space-y-7 pt-[calc(var(--safe-top,0px)+1rem)]">
        <SiteGuideBackLink />
        <header>
          <h1 className="text-3xl font-black tracking-tight">サイトの更新履歴</h1>
          <p className="mt-3 text-sm leading-relaxed text-nicchyo-ink/75">来訪者向けの主な変更を、公開日ごとにまとめています。</p>
          {upcoming.length > 0 && (
            <a href="#upcoming-versions" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">
              準備中の変更を見る
            </a>
          )}
        </header>
        <section aria-labelledby="released-versions">
          <h2 id="released-versions" className="mb-3 text-lg font-bold">公開済みの変更</h2>
          <ol className="space-y-3">
            {released.map((entry) => <VersionCard key={entry.version} entry={entry} />)}
          </ol>
        </section>
        {upcoming.length > 0 && (
          <section aria-labelledby="upcoming-versions">
            <h2 id="upcoming-versions" className="mb-3 scroll-mt-6 text-lg font-bold">一般公開に向けて準備中</h2>
            <ul className="space-y-3">
              {upcoming.map((entry) => <VersionCard key={entry.version} entry={entry} />)}
            </ul>
          </section>
        )}
      </PageContainer>
    </PageShell>
  );
}

function VersionCard({ entry }: { entry: VersionEntry }) {
  return (
    <li className="rounded-card bg-white p-5 ring-1 ring-line">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-chip bg-nicchyo-soft-green/50 px-2.5 py-1 text-xs font-bold">{entry.version}</span>
        <VersionDate released={entry.released} date={entry.date} />
      </div>
      <h3 className="font-bold">{entry.title}</h3>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-nicchyo-ink/75">
        {entry.highlights.map((highlight, index) => <li key={index}>{highlight}</li>)}
      </ul>
    </li>
  );
}
