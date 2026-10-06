import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

// 旧 public/robots.txt を移したもの。静的ファイルでは環境変数を読めず、
// sitemap の場所だけドメイン直書きで取り残されていたため、SITE_URL を使う形にした（#661）
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 出店者・管理者・プライベートページはインデックス不要
      disallow: [
        "/admin/",
        "/vendor/",
        "/my-shop/",
        "/api/",
        "/private/",
        "/analysis/",
        "/reports/",
        "/supabase-test/",
        "/oauth/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
