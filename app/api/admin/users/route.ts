import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole, isAdmin, normalizeRole } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VendorRow = {
  id: string;
  shop_name: string | null;
  owner_name: string | null;
  updated_at?: string | null;
};

type AdminUserRecord = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  vendorId?: string;
  registeredDate: string;
  lastLogin: string;
  status: "active" | "suspended";
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "未ログイン";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未ログイン";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAdmin(getRole(user))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Supabase admin env missing" }, { status: 500 });
    }

    const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const allUsers: Array<{
      id: string;
      email?: string;
      created_at?: string;
      last_sign_in_at?: string;
      banned_until?: string | null;
      app_metadata?: { role?: string };
      user_metadata?: {
        role?: string;
        name?: string;
        full_name?: string;
        avatar_url?: string;
        avatarUrl?: string;
      };
    }> = [];

    let page = 1;
    const perPage = 200;

    while (true) {
      const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
      if (error) {
        return NextResponse.json({ error: "Failed to fetch auth users" }, { status: 500 });
      }
      const pageUsers = (data.users ?? []) as Array<{
        id: string;
        email?: string;
        created_at?: string;
        last_sign_in_at?: string;
        banned_until?: string | null;
        app_metadata?: { role?: string };
        user_metadata?: {
          role?: string;
          name?: string;
          full_name?: string;
          avatar_url?: string;
          avatarUrl?: string;
        };
      }>;
      allUsers.push(...pageUsers);
      if (pageUsers.length < perPage) break;
      page += 1;
    }

    const { data: vendorsData, error: vendorsError } = await serviceClient
      .from("vendors")
      .select("id, shop_name, owner_name, updated_at");

    if (vendorsError) {
      return NextResponse.json({ error: "Failed to fetch vendors" }, { status: 500 });
    }

    const vendors = Array.isArray(vendorsData) ? (vendorsData as VendorRow[]) : [];
    const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));

    const users: AdminUserRecord[] = allUsers.map((authUser) => {
      const vendor = vendorById.get(authUser.id);
      const role = normalizeRole(authUser.app_metadata?.role ?? authUser.user_metadata?.role);
      const name =
        vendor?.shop_name ??
        authUser.user_metadata?.name ??
        authUser.user_metadata?.full_name ??
        vendor?.owner_name ??
        authUser.email?.split("@")[0] ??
        "名称未設定";
      const bannedUntil = authUser.banned_until ? new Date(authUser.banned_until) : null;
      const isSuspended =
        bannedUntil !== null && !Number.isNaN(bannedUntil.getTime()) && bannedUntil.getTime() > Date.now();

      return {
        id: authUser.id,
        name,
        email: authUser.email ?? "",
        role,
        avatarUrl: authUser.user_metadata?.avatarUrl ?? authUser.user_metadata?.avatar_url,
        vendorId: vendor?.id,
        registeredDate: formatDate(authUser.created_at),
        lastLogin: formatDateTime(authUser.last_sign_in_at),
        status: isSuspended ? "suspended" : "active",
      };
    });

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}
