import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { ReactNode } from "react";

export default async function ModeratorLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const role = (user?.app_metadata as { role?: string } | undefined)?.role;
  const isAllowed = role === "admin" || role === "moderator";

  if (!user || !isAllowed) {
    redirect("/");
  }

  return <>{children}</>;
}
