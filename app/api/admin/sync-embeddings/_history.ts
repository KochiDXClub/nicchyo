import { createAdminServiceClient, type AdminApiContext } from "@/lib/auth/requireAdminApi";

export function embeddingSyncClient(defaultClient?: AdminApiContext["adminClient"]) {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  return defaultClient && url === process.env.NEXT_PUBLIC_SUPABASE_URL
    ? defaultClient
    : createAdminServiceClient(url);
}
