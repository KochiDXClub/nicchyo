import NavigationBar from "../../components/NavigationBar";
import { Badge, EmptyMessage, PageContainer, PageShell, PageTitle, Surface } from "@/components/ui";
import { fetchActiveAnnouncements } from "@/lib/announcements/fetchActive.server";
import { formatAnnouncementDate } from "@/lib/announcements/format";
import { getLocale, getT } from "@/lib/i18n/server";

// 公開期間の切り替わりも、最大1分で反映する
export const revalidate = 60;

export async function generateMetadata() {
  const t = await getT();
  return {
    title: t("お知らせ"),
    description: t("nicchyo（ニッチョ）の運営からのお知らせです。"),
  };
}

export default async function NewsPage() {
  const locale = await getLocale();
  const t = await getT();
  const announcements = await fetchActiveAnnouncements(new Date(), locale);

  return (
    <PageShell as="main">
      <PageTitle title={t("お知らせ")} width="narrow" />

      <PageContainer width="narrow">
        {announcements.length === 0 ? (
          <EmptyMessage message={t("いまのところ、お知らせはありません。")} padding="py-16" />
        ) : (
          <ul className="space-y-4 pb-8">
            {announcements.map((a) => (
              <li key={a.id}>
                <Surface as="article" padding="none" className="relative overflow-hidden px-5 py-5 sm:px-6">
                  {a.important ? (
                    // 重要なお知らせだけ、ブランドの緑の縦線で印をつける（docs/DESIGN_SYSTEM.md の「しるし」）
                    <span aria-hidden className="absolute inset-y-5 left-0 w-[3px] rounded-r-full bg-nicchyo-primary" />
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <time dateTime={a.startsAt} className="text-xs font-medium text-nicchyo-ink/55">
                      {formatAnnouncementDate(a.startsAt, locale)}
                    </time>
                    {a.important ? <Badge variant="caution">{t("重要")}</Badge> : null}
                  </div>
                  <h2 lang={a.lang} className="mt-2 text-lg font-bold leading-snug text-nicchyo-ink">
                    {a.title}
                  </h2>
                  <p lang={a.lang} className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-nicchyo-ink/75 sm:text-base">
                    {a.body}
                  </p>
                </Surface>
              </li>
            ))}
          </ul>
        )}
      </PageContainer>

      <NavigationBar />
    </PageShell>
  );
}
