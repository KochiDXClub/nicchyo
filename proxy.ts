import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/middleware";
import { getRole, isModerator } from "@/lib/auth/permissions";

export async function proxy(request: NextRequest) {
  const { supabase, getResponse } = createClient(request);

  // セッション更新（Supabase Auth）
  // getUser() 内でセッションリフレッシュが起きると createClient 内の supabaseResponse が
  // 再代入されるため、呼び出し後に getResponse() で最新のレスポンスを取得する
  const { data: { user } } = await supabase.auth.getUser();
  const supabaseResponse = getResponse();

  // パスベースのアクセス制御
  const pathname = request.nextUrl.pathname;
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

  // ノンスを生成してCSPヘッダーに設定
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic': nonce 付きスクリプトが動的にロードするスクリプトにも信頼を伝播
    // 'unsafe-inline': strict-dynamic 非対応の古いブラウザ向けフォールバック
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' https:${process.env.NODE_ENV === "development" ? " http://127.0.0.1:* ws://127.0.0.1:*" : ""}`,
    "frame-ancestors 'none'",
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
