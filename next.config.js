/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Leaflet が開発モードで二重初期化されるのを防ぐ

  // 画像最適化設定
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        // Supabase Storage（出店者がアップロードした店舗写真・投稿画像）
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
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
      {
        source: '/news',
        destination: '/calendar',
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
        // iframe 埋め込みは原則禁止。
        // 例外は管理画面の計測ページ（/admin/map-perf）が同一オリジンで読み込む /map?perf=1 だけで、
        // そのときは proxy.ts の CSP frame-ancestors 'self' に委ねる（CSP があれば X-Frame-Options は無視される）。
        source: '/:path*',
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
