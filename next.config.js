/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Leaflet が開発モードで二重初期化されるのを防ぐ

  experimental: {
    // 直前に見たページの内容を一定時間クライアントに残す（Next 15 以降の既定は 0 秒＝残さない）。
    // マップ→相談→マップのように戻ってきたときにサーバー往復ぶんを丸ごと省ける。
    // サーバー側で描いた内容が最大 30 秒古いままになりうるので、
    // ログアウト時は AuthContext から router.refresh() で必ず捨てる。
    staleTimes: { dynamic: 30 },
  },

  // 画像最適化設定
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400, // 店舗写真は出店者の更新時に ?v= 付きの新URLになる（管理者の差し替えは同URL。最大1日古い写真が残りうる）
    remotePatterns: [
      {
        // Supabase Storage（出店者がアップロードした店舗写真・投稿画像）
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        // Google アカウントの写真（出店者のアカウントの写真。lib/auth/displayName.ts の許可と同じ）
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },

  // 本番環境の圧縮設定
  compress: true,

  // パフォーマンス最適化
  poweredByHeader: false, // X-Powered-By ヘッダーを無効化（セキュリティ向上）

  // /shops001 -> /shops/001 へ内部リライト
  async rewrites() {
    return [
      {
        source: '/shops:shopCode(\\d{3})',
        destination: '/shops/:shopCode',
      },
    ];
  },

  // /news は「日曜市カレンダー」(/calendar) に作り替えたため、旧URLを転送する
  async redirects() {
    return [
      // 近況を出す画面と投稿履歴は /vendor/posts の1ページにまとめた
      {
        source: '/vendor/post/new',
        destination: '/vendor/posts',
        permanent: true,
      },
      {
        source: '/news',
        destination: '/calendar',
        permanent: true,
      },
      // 週次セキュリティレポートの通知リンク（旧 /reports/:date）を管理画面へ誘導する
      {
        source: '/reports/:date',
        destination: '/admin/security-reports/:date',
        permanent: false,
      },
      // 買い物リストはお気に入りに一本化した。配ったQRコードや外部リンクが
      // /bag を指していても迷子にしない
      {
        source: '/bag',
        destination: '/favorites',
        permanent: true,
      },
      // 開催ステータス・予定の入稿は /admin/calendar に一本化した
      {
        source: '/admin/market-days',
        destination: '/admin/calendar',
        permanent: true,
      },
      {
        source: '/admin/events',
        destination: '/admin/calendar',
        permanent: true,
      },
      // 出店者の分析は1ページにまとめた。ブックマークや使い方ガイドの古いリンクを迷子にしない
      {
        source: '/vendor/analytics/:page(time|products|ai|input)',
        destination: '/vendor/analytics',
        permanent: true,
      },
    ];
  },

  // セキュリティヘッダー（CSPはproxy.tsでnonce付きで動的に設定）
  async headers() {
    return [
      {
        // 全ページ共通セキュリティヘッダー
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)'
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          },
        ],
      },
      {
        // 地図の Worker と建物・背景画像。ファイル名にハッシュが無く immutable にできないので、
        // 1 日はそのまま使い、その後は裏で再取得しつつ古いものを返す
        source: '/maplibre/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800'
          },
        ],
      },
      {
        source: '/images/maps/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800'
          },
        ],
      },
      {
        // iframe 埋め込みは原則禁止（/map 以外は無条件）。
        source: '/:path((?!map$).*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
        ],
      },
      {
        // /map も原則禁止。
        // 例外は管理画面の計測ページ（/admin/map-perf）が同一オリジンで読み込む /map?perf=1 だけで、
        // そのときは proxy.ts の CSP frame-ancestors 'self' に委ねる（CSP があれば X-Frame-Options は無視される）。
        source: '/map',
        missing: [{ type: 'query', key: 'perf', value: '1' }],
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
