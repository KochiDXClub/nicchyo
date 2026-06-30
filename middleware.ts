import { type NextRequest, NextResponse } from "next/server";

// Edge ランタイムで動作するモジュールレベルキャッシュ（warm instance 間で共有）
let maintenanceCache: { enabled: boolean; message: string; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // 60秒

async function getMaintenanceStatus(origin: string): Promise<{ enabled: boolean; message: string }> {
  if (maintenanceCache && Date.now() < maintenanceCache.expiresAt) {
    return maintenanceCache;
  }

  try {
    const res = await fetch(`${origin}/api/maintenance-status`, {
      headers: { "x-internal-check": "1" },
    });
    if (!res.ok) return { enabled: false, message: "" };
    const data = await res.json() as { enabled?: boolean; message?: string };
    const result = {
      enabled: data.enabled === true,
      message: typeof data.message === "string" ? data.message : "",
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    maintenanceCache = result;
    return result;
  } catch {
    return { enabled: false, message: "" };
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 管理者・API・静的ファイル・メンテナンスページ自体はスキップ
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/maintenance") ||
    pathname.startsWith("/private") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const origin = request.nextUrl.origin;
  const { enabled, message } = await getMaintenanceStatus(origin);

  if (enabled) {
    const url = request.nextUrl.clone();
    url.pathname = "/maintenance";
    if (message) url.searchParams.set("msg", message);
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
