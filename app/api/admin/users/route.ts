import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole, isAdmin, normalizeRole, ROLE_HIERARCHY } from "@/lib/auth/permissions";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
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

// vendor / general_user への招待は admin が操作可。
// moderator / admin への昇格は admin のみ可。
const INVITABLE_ROLES = ROLE_HIERARCHY.filter((r) => r !== "admin");

function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return local.length <= 64 && domain.length > 0 && domain.includes(".") && !domain.endsWith(".");
}

export async function POST(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "admin-users-invite",
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdmin(getRole(user))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { email?: string; role?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const role = body.role ?? "general_user";

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "有効なメールアドレスを入力してください" }, { status: 400 });
  }
  if (!INVITABLE_ROLES.includes(role as typeof INVITABLE_ROLES[number])) {
    return NextResponse.json({ error: "無効なロールです" }, { status: 400 });
  }

  const callerRole = getRole(user);
  if (role === "moderator" && callerRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
  }

  const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 招待メール送信
  const { data: invited, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email);
  if (inviteError) {
    console.error("[admin/users] invite failed:", inviteError.message);
    const alreadyExists = inviteError.code === "email_exists";
    return NextResponse.json(
      { error: alreadyExists ? "このメールアドレスはすでに登録されています" : "招待メールの送信に失敗しました" },
      { status: alreadyExists ? 409 : 500 }
    );
  }

  // ロールを app_metadata に設定
  const { error: roleError } = await serviceClient.auth.admin.updateUserById(invited.user.id, {
    app_metadata: { role },
  });
  if (roleError) {
    console.error("[admin/users] role set failed:", roleError.message);
    await serviceClient.from("admin_audit_logs").insert({
      actor_id: user.id,
      actor_email: user.email,
      actor_role: getRole(user),
      action: "invite_user_role_set_failed",
      target_type: "user",
      target_id: invited.user.id,
      target_name: email,
      details: `ロール: ${role} の設定に失敗: ${roleError.message}`,
    });
    return NextResponse.json({ error: "招待は完了しましたがロールの設定に失敗しました" }, { status: 500 });
  }

  // 監査ログ
  await serviceClient.from("admin_audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    actor_role: getRole(user),
    action: "invite_user",
    target_type: "user",
    target_id: invited.user.id,
    target_name: email,
    details: `ロール: ${role} で招待`,
  });

  return NextResponse.json({ ok: true, userId: invited.user.id });
}
