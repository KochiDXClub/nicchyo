import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Supabase Auth の全ユーザーをページングしながら取得する
 * （auth.admin.listUsers は1回の呼び出しにつき最大200件までしか返さないため）
 */
export async function listAllAuthUsers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serviceClient: SupabaseClient<any, any, any>
): Promise<{ users: User[] } | { error: string }> {
  const users: User[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
    if (error) return { error: error.message };
    const pageUsers = data.users ?? [];
    users.push(...pageUsers);
    if (pageUsers.length < perPage) break;
    page += 1;
  }

  return { users };
}
