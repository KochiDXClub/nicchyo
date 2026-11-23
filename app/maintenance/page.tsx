import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/adminClient";

export const metadata: Metadata = {
  title: "メンテナンス中",
  robots: { index: false, follow: false },
};

const DEFAULT_MESSAGE =
  "現在システムメンテナンスのためサービスを一時停止しています。\nしばらくしてからもう一度アクセスしてください。";

async function getMaintenanceMessage(): Promise<string> {
  try {
    const dc = createAdminClient();
    if (!dc) return DEFAULT_MESSAGE;
    const { data } = await dc
      .from("system_settings")
      .select("value")
      .eq("key", "public")
      .maybeSingle();
    const value = data?.value as Record<string, unknown> | null;
    const msg = typeof value?.maintenanceMessage === "string" ? value.maintenanceMessage.trim() : "";
    return msg || DEFAULT_MESSAGE;
  } catch {
    return DEFAULT_MESSAGE;
  }
}

export default async function MaintenancePage() {
  const message = await getMaintenanceMessage();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-nicchyo-base px-4 text-center">
      <span className="text-6xl" aria-hidden="true">🔧</span>
      <h1 className="mt-6 font-display text-3xl font-bold text-nicchyo-ink">
        メンテナンス中
      </h1>
      <p className="mt-4 max-w-md whitespace-pre-wrap text-sm leading-relaxed text-nicchyo-ink/70">
        {message}
      </p>
      <p className="mt-8 text-xs text-nicchyo-ink/40">nicchyo – 日曜市デジタルマップ</p>
    </main>
  );
}
