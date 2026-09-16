import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/middleware";
import { getRole, isModerator } from "@/lib/auth/permissions";
import {
  EMPTY_PAGE_VISIBILITY_SETTINGS,
  parsePageVisibilitySettings,
  resolvePageVisibility,
  toVisibilityRole,
  type PageVisibilitySettings,
} from "@/lib/pageVisibility";

// サイト設定（メンテナンスモード・ページ公開設定）: 60秒キャッシュ（warm インスタンス間で共有）
type SiteSettings = {
  maintenance: { enabled: boolean; message: string };
  pageVisibility: PageVisibilitySettings;
};
const DEFAULT_SITE_SETTINGS: SiteSettings = {
  maintenance: { enabled: false, message: "" },
  pageVisibility: EMPTY_PAGE_VISIBILITY_SETTINGS,
};
let siteSettingsCache: { value: SiteSettings; expiresAt: number } | null = null;
const SITE_SETTINGS_CACHE_TTL = 60_000;

async function getSiteSettings(): Promise<SiteSettings> {
  if (siteSettingsCache && Date.now() < siteSettingsCache.expiresAt) {
    return siteSettingsCache.value;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return DEFAULT_SITE_SETTINGS;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/system_settings?key=in.(public,page_visibility)&select=key,value`,
      {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return DEFAULT_SITE_SETTINGS;
    const rows = (await res.json()) as Array<{ key: string; value: Record<string, unknown> }>;
    const publicValue = rows.find((row) => row.key === "public")?.value;
    const visibilityValue = rows.find((row) => row.key === "page_visibility")?.value;
    const value: SiteSettings = {
      maintenance: {
        enabled: publicValue?.maintenanceMode === true,
        message:
          typeof publicValue?.maintenanceMessage === "string" ? publicValue.maintenanceMessage : "",
      },
      pageVisibility: parsePageVisibilitySettings(visibilityValue),
    };
    siteSettingsCache = { value, expiresAt: Date.now() + SITE_SETTINGS_CACHE_TTL };
    return value;
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

const MAINTENANCE_SKIP_PREFIXES = ["/admin", "/api", "/_next", "/maintenance"];
const MAINTENANCE_SKIP_EXACT = ["/robots.txt", "/sitemap.xml", "/favicon.ico"];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // 管理者・API・静的ファイルはメンテナンス判定・公開設定判定の対象外
  // /_next 配下に全静的アセットが含まれるため、ドット有無による判定は不要
  // /private は一般ログインユーザー向けのため、メンテナンス中は他ページと同様にブロックする
  const isPageRequest =
    !MAINTENANCE_SKIP_PREFIXES.some((p) => pathname.startsWith(p)) &&
    !MAINTENANCE_SKIP_EXACT.includes(pathname);
  const siteSettings = isPageRequest ? await getSiteSettings() : DEFAULT_SITE_SETTINGS;

  // メンテナンスモードチェック
  if (isPageRequest && siteSettings.maintenance.enabled) {
    const url = request.nextUrl.clone();
    url.pathname = "/maintenance";
    url.search = "";
    return NextResponse.rewrite(url);
  }

  const { supabase, getResponse } = createClient(request);

  // セッション更新（Supabase Auth）
  // getUser() 内でセッションリフレッシュが起きると createClient 内の supabaseResponse が
  // 再代入されるため、呼び出し後に getResponse() で最新のレスポンスを取得する
  const { data: { user } } = await supabase.auth.getUser();
  const supabaseResponse = getResponse();

  // パスベースのアクセス制御
  const appRole = getRole(user);

  if (pathname.startsWith("/admin") || pathname.startsWith("/moderator")) {
    const allowed = isModerator(appRole);
    if (!user || !allowed) {
      const redirectRes = NextResponse.redirect(new URL("/", request.url));
      supabaseResponse.cookies.getAll().forEach(({ name, value }) => {
        redirectRes.cookies.set(name, value);
      });
      return redirectRes;
    }
  }

  if (pathname.startsWith("/my-shop") || pathname.startsWith("/vendor")) {
    if (!user || appRole !== "vendor") {
      const redirectRes = NextResponse.redirect(new URL("/", request.url));
      supabaseResponse.cookies.getAll().forEach(({ name, value }) => {
        redirectRes.cookies.set(name, value);
      });
      return redirectRes;
    }
  }

  // ページ公開設定（管理画面で設定した「非公開」ページをロール別に遮断）
  if (isPageRequest) {
    const visibilityRole = toVisibilityRole(appRole, !!user);
    // next.config の rewrite（/shops001 → /shops/001）は proxy より後に効くため、ここで正規化する
    const visibilityPath = pathname.replace(/^\/shops(\d{3})$/, "/shops/$1");
    const visibility = resolvePageVisibility(visibilityPath, visibilityRole, siteSettings.pageVisibility);
    if (visibility.state === "private") {
      // リダイレクト先自身が非公開ならループになるためホームへ逃がす
      const target = visibility.redirectTo;
      const targetVisible =
        resolvePageVisibility(target, visibilityRole, siteSettings.pageVisibility).state !== "private";
      const destination = targetVisible && target !== visibilityPath ? target : "/map";
      const redirectRes = NextResponse.redirect(new URL(destination, request.url));
      supabaseResponse.cookies.getAll().forEach(({ name, value }) => {
        redirectRes.cookies.set(name, value);
      });
      return redirectRes;
    }
  }

  // ノンスを生成してCSPヘッダーに設定
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // 管理画面の計測ページ（/admin/map-perf）が同一オリジンの iframe で /map?perf=1 を読み込む。
  // このときだけ frame-ancestors を 'self' に緩める（他オリジンからの埋め込みは引き続き禁止）。
  const isPerfFramedMap =
    pathname === "/map" && request.nextUrl.searchParams.get("perf") === "1";

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic': nonce 付きスクリプトが動的にロードするスクリプトにも信頼を伝播
    // 'unsafe-inline': strict-dynamic 非対応の古いブラウザ向けフォールバック
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' https:${process.env.NODE_ENV === "development" ? " http://127.0.0.1:* ws://127.0.0.1:*" : ""}`,
    // MapLibre GL JS はタイルのデコードを blob: URL の Web Worker で行う
    "worker-src 'self' blob:",
    isPerfFramedMap ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "report-uri /api/security/csp-report",
  ].join("; ");

  // ノンスをリクエストヘッダーに渡す（Server Components から参照可能）
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // レスポンスにCSPヘッダーとSupabase Cookieを設定（リフレッシュ後の最新 Cookie を使用）
  res.headers.set("content-security-policy", csp);
  supabaseResponse.cookies.getAll().forEach(({ name, value }) => {
    res.cookies.set(name, value);
  });

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
