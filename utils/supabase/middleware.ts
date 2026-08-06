import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const createClient = (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Mock supabase client if env vars are missing
  if (!supabaseUrl || !supabaseKey) {
    const mockSupabase: {
      auth: { getUser: () => Promise<{ data: { user: null }; error: null }> };
    } = {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    };
    return { supabase: mockSupabase, getResponse: () => supabaseResponse };
  }

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        // setAll は supabaseResponse を再代入するため、呼び出し元は getResponse() で最新を取得する
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  return { supabase, getResponse: () => supabaseResponse };
};
