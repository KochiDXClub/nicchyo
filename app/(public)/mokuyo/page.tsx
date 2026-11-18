import { notFound } from "next/navigation";
import NavigationBar from "../../components/NavigationBar";
import { PageContainer, PageShell, Surface } from "@/components/ui";
import { fetchPublicMarketBySlug } from "@/lib/market/publicMarkets.server";

// 公開の切り替えは管理画面から行うため、短い間隔で反映する
export const revalidate = 300;

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export async function generateMetadata() {
  const market = await fetchPublicMarketBySlug("mokuyo");
  return {
    title: market ? `${market.name}のご案内` : "木曜市",
    description: "高知市の木曜市の場所と開催日のご案内です。",
  };
}

/** 木曜市の紹介ページ（/mokuyo）。市が公開されていないときは見せない。 */
export default async function MokuyoPage() {
  const market = await fetchPublicMarketBySlug("mokuyo");
  if (!market) notFound();

  return (
    <PageShell>
      <NavigationBar />
      <PageContainer>
        <Surface>
          <h1 className="text-2xl font-bold">{market.name}</h1>
          <p className="mt-3">毎週{WEEKDAYS[market.weekday]}曜日に開かれる市です。</p>
          <p className="mt-3">市の場所は、準備ができしだいこのページでご案内します。</p>
        </Surface>
      </PageContainer>
    </PageShell>
  );
}
