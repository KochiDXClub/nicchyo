import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getRole } from "@/lib/auth/permissions";
import { invitationReturnPath, oauthDestination, OAUTH_RETURN_COOKIE } from "@/lib/auth/oauthRedirect";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const store = await cookies();
  const invitation = invitationReturnPath(store.get(OAUTH_RETURN_COOKIE)?.value);
  const code = request.nextUrl.searchParams.get("code");
  let destination = "/login?error=oauth";

  try {
    if (code && !request.nextUrl.searchParams.has("error")) {
      const supabase = createClient(store);
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const { data, error: userError } = await supabase.auth.getUser();
        if (!userError && data.user) destination = oauthDestination(getRole(data.user), invitation);
      }
    }
  } catch {
    // Authentication failures must not disclose provider or token details.
  }

  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set(OAUTH_RETURN_COOKIE, "", { path: "/auth/callback", maxAge: 0, sameSite: "lax", secure: request.nextUrl.protocol === "https:" });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
