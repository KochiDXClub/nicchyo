import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";
import type { DatabaseWithExtensions } from "@/types/database.extensions";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function buildCookieAdapter(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      } catch {
        // ignore calls from Server Components
      }
    },
  };
}

export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase env vars are missing.");
  }

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: buildCookieAdapter(cookieStore),
  });
};

/**
 * まだ `supabase gen types` に反映されていないテーブル（types/database.extensions.ts参照）を
 * 扱うルート専用。`createClient` の戻り値型（`ReturnType<typeof createClient>`）に依存している
 * 既存コードが複数あるため、`createClient` 自体をジェネリック化せず別関数として追加している。
 */
export const createClientWithExtensions = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase env vars are missing.");
  }

  return createServerClient<DatabaseWithExtensions>(supabaseUrl, supabaseKey, {
    cookies: buildCookieAdapter(cookieStore),
  });
};
