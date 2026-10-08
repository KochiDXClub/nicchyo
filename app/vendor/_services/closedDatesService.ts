import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

// 出店しない日（休業日）を vendors.closed_dates 列で読み書きする。
// 日付は "YYYY-MM-DD" 形式の文字列で扱う。
//
// NOTE: closed_dates 列はマイグレーション
// (20260718182137_add_closed_dates_to_vendors.sql) で追加する。
// 生成済みの Database 型に列が反映されるまでは、ジェネリック無しの
// SupabaseClient にキャストして参照する（型再生成後はキャストを外せる）。
function untypedClient(): SupabaseClient {
  return createClient() as unknown as SupabaseClient;
}

export async function fetchClosedDates(vendorId: string): Promise<string[]> {
  const supabase = untypedClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("closed_dates")
    .eq("id", vendorId)
    .single();

  if (error || !data) return [];
  const dates = (data.closed_dates as string[] | null) ?? [];
  return dates.map((d) => d.slice(0, 10));
}

export async function saveClosedDates(vendorId: string, dates: string[]): Promise<void> {
  const supabase = untypedClient();
  const { error } = await supabase
    .from("vendors")
    .update({ closed_dates: dates, updated_at: new Date().toISOString() })
    .eq("id", vendorId);

  if (error) throw error;
}
