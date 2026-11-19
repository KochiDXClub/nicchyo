import NavigationBar from "../../components/NavigationBar";
import { Badge, PageContainer, PageShell, Surface } from "@/components/ui";
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
      <div className="bg-amber-100/40 pb-6 pt-safe-top">
        <PageContainer width="narrow" className="pt-6">
          <h1 className="text-2xl font-bold tracking-tight">{t("お知らせ")}</h1>
        </PageContainer>
      </div>

      <PageContainer width="narrow">
        {announcements.length === 0 ? (
          <p className="py-12 text-center text-sm text-nicchyo-ink/55">{t("いまのところ、お知らせはありません。")}</p>
        ) : (
          <ul className="space-y-3 pb-8">
            {announcements.map((a) => (
              <li key={a.id}>
                <Surface as="article" padding="sm">
                  <div className="flex items-center gap-2">
                    <time dateTime={a.startsAt} className="text-xs text-nicchyo-ink/55">
                      {formatAnnouncementDate(a.startsAt, locale)}
                    </time>
                    {a.important ? <Badge variant="caution">{t("重要")}</Badge> : null}
                  </div>
                  <h2 lang={a.lang} className="mt-1 text-base font-bold text-nicchyo-ink">{a.title}</h2>
                  <p lang={a.lang} className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-nicchyo-ink/80">{a.body}</p>
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
