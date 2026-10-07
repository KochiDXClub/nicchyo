import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatabaseWithExtensions } from "@/types/database.extensions";
import { detectAbuse } from "@/lib/security/abuseDetector";

/**
 * 自動ブロックの方針。
 * - 1回の検知では今回のリクエストだけ拒否し、恒久ブロックは作らない
 *   （共有IP・誤検知で他の来訪者まで締め出さないため）
 * - ABUSE_BLOCK_WINDOW_MS の間に ABUSE_BLOCK_THRESHOLD 回検知された IP / visitor_key
 *   だけをブロック対象にする
 * - ブロックは作成から ABUSE_BLOCK_WINDOW_MS だけ有効（テーブルに期限列が無いので
 *   照合時に created_at で絞る）
 */
export const ABUSE_BLOCK_THRESHOLD = 3;
export const ABUSE_BLOCK_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function handleAbuseDetection(
  supabase: SupabaseClient<DatabaseWithExtensions>,
  ip: string | null,
  text: string,
  visitorKey?: string
): Promise<"blocked" | "ok"> {
  const since = new Date(Date.now() - ABUSE_BLOCK_WINDOW_MS).toISOString();

  // Check blocklist in parallel for IP and visitor_key
  if (ip || visitorKey) {
    const [ipResult, visitorResult] = await Promise.all([
      ip
        ? supabase.from("ai_abuse_blocks").select("id").eq("is_active", true).gte("created_at", since).eq("ip_address", ip).limit(1)
        : Promise.resolve({ data: [] }),
      visitorKey
        ? supabase.from("ai_abuse_blocks").select("id").eq("is_active", true).gte("created_at", since).eq("visitor_key", visitorKey).limit(1)
        : Promise.resolve({ data: [] }),
    ]);
    const isBlocked =
      (ipResult.data && ipResult.data.length > 0) ||
      (visitorResult.data && visitorResult.data.length > 0);
    if (isBlocked) return "blocked";
  }

  const abuse = detectAbuse(text);
  if (abuse) {
    const shouldBlock = abuse.severity >= 3;
    await supabase.from("ai_abuse_events").insert({
      ip_address: ip,
      visitor_key: visitorKey ?? null,
      event_type: abuse.type,
      message: text.slice(0, 200),
      severity: abuse.severity,
      blocked: shouldBlock,
    });
    if (shouldBlock) {
      if (ip || visitorKey) {
        const recent = await countRecentBlockedEvents(supabase, ip, visitorKey, since);
        if (recent >= ABUSE_BLOCK_THRESHOLD) {
          await supabase.from("ai_abuse_blocks").insert({
            ip_address: ip ?? null,
            visitor_key: visitorKey ?? null,
            reason: `${abuse.reason}（${recent}回検知）`,
          });
          await supabase.from("admin_notifications").insert({
            type: "ai_abuse",
            title: `AI不正アクセスをブロック（${abuse.type}）`,
            body: `IP: ${ip ?? "不明"} | visitor: ${visitorKey ?? "不明"} | ${abuse.reason} | 内容: ${text.slice(0, 80)}`,
            link: "/admin/audit-logs",
          });
        }
      }
      return "blocked";
    }
  }

  return "ok";
}

async function countRecentBlockedEvents(
  supabase: SupabaseClient<DatabaseWithExtensions>,
  ip: string | null,
  visitorKey: string | undefined,
  since: string
): Promise<number> {
  const count = (column: "ip_address" | "visitor_key", value: string) =>
    supabase
      .from("ai_abuse_events")
      .select("id", { count: "exact", head: true })
      .eq("blocked", true)
      .gte("created_at", since)
      .eq(column, value);
  const [ipResult, visitorResult] = await Promise.all([
    ip ? count("ip_address", ip) : Promise.resolve({ count: 0 }),
    visitorKey ? count("visitor_key", visitorKey) : Promise.resolve({ count: 0 }),
  ]);
  return Math.max(ipResult.count ?? 0, visitorResult.count ?? 0);
}
