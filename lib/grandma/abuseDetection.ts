import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatabaseWithExtensions } from "@/types/database.extensions";
import { detectAbuse } from "@/lib/security/abuseDetector";

export async function handleAbuseDetection(
  supabase: SupabaseClient<DatabaseWithExtensions>,
  ip: string | null,
  text: string,
  visitorKey?: string
): Promise<"blocked" | "ok"> {
  // Check blocklist in parallel for IP and visitor_key
  if (ip || visitorKey) {
    const [ipResult, visitorResult] = await Promise.all([
      ip
        ? supabase.from("ai_abuse_blocks").select("id").eq("is_active", true).eq("ip_address", ip).limit(1)
        : Promise.resolve({ data: [] }),
      visitorKey
        ? supabase.from("ai_abuse_blocks").select("id").eq("is_active", true).eq("visitor_key", visitorKey).limit(1)
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
    if (shouldBlock && (ip || visitorKey)) {
      await supabase.from("ai_abuse_blocks").insert({
        ip_address: ip ?? null,
        visitor_key: visitorKey ?? null,
        reason: abuse.reason,
      });
      await supabase.from("admin_notifications").insert({
        type: "ai_abuse",
        title: `AI不正アクセスをブロック（${abuse.type}）`,
        body: `IP: ${ip ?? "不明"} | visitor: ${visitorKey ?? "不明"} | ${abuse.reason} | 内容: ${text.slice(0, 80)}`,
        link: "/admin/audit-logs",
      });
      return "blocked";
    }
  }

  return "ok";
}
