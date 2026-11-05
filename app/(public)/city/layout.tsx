import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { canAccessCity, getRole } from "@/lib/auth/permissions";
import type { ReactNode } from "react";
import { CityConsole } from "@/components/city/CityConsole";

/**
 * 高知市（市役所）向けページの入口。city_official と admin だけ入れる。
 * proxy.ts でも同じ判定をしているが、layout 側でも必ず確かめる（二重で守る）。
 */
export default async function CityLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !canAccessCity(getRole(user))) {
    redirect("/");
  }

  return <CityConsole>{children}</CityConsole>;
}
