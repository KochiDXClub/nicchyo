import { SITE_URL } from "@/lib/constants";

/**
 * 日曜市の開催情報（schema.org の Event）。検索結果に「毎週日曜・追手筋」の開催情報を出してもらうためのもの。
 *
 * 地図（/map）とトップ（/）の両方に載せるので、ここ1か所で持つ（片方だけ直して食い違わないように）。
 * 埋め込むときは safeJsonLd（lib/utils/jsonLd）を通す
 */
export const SUNDAY_MARKET_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Event",
  name: "高知日曜市",
  description:
    "高知市追手筋で毎週日曜日に開催される大規模な路上市場。約300店舗が農産物・工芸品・骨董など多彩な品を並べます。",
  eventSchedule: {
    "@type": "Schedule",
    byDay: "https://schema.org/Sunday",
  },
  location: {
    "@type": "Place",
    name: "追手筋（高知城前〜追手筋東端）",
    address: {
      "@type": "PostalAddress",
      streetAddress: "追手筋",
      addressLocality: "高知市",
      addressRegion: "高知県",
      addressCountry: "JP",
    },
  },
  organizer: {
    "@type": "Organization",
    name: "nicchyo（ニッチョ）",
    url: SITE_URL,
  },
};
