/**
 * マップに載っている店舗の数を数える（サーバー側）
 *
 * 運営費ページで「何を支えることになるのか」を1つの数字で出すために使う。
 * 取れなかったときは null を返し、呼び出し側で「集計中」として扱う。
 * 数字が出ないことよりページが落ちることの方が困るので、失敗は握りつぶす。
 */

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

function hasSupabaseEnv() {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  );
}

/** マップに載っている店舗数。取れなければ null */
export async function fetchPublishedShopCount(): Promise<number | null> {
  if (!hasSupabaseEnv()) return null;

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    // 行の中身は要らないので head: true。id は匿名にも GRANT されている
    const { count, error } = await supabase
      .from("vendors")
      .select("id", { count: "exact", head: true });

    if (error || typeof count !== "number") return null;
    return count;
  } catch (error) {
    console.warn("[shopCount] 店舗数の取得に失敗しました:", error);
    return null;
  }
}
