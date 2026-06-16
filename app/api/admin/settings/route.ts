import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getRole, isAdmin } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicSettings = {
  siteName: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  publicAnnouncementEnabled: boolean;
  publicAnnouncement: string;
};

type MapSettings = {
  maxLandmarks: number;
  maxUnassignedShopMarkers: number;
  maxMapSnapshots: number;
  maxEditZoom: number;
};

const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  siteName: "nicchyo",
  maintenanceMode: false,
  maintenanceMessage: "",
  publicAnnouncementEnabled: false,
  publicAnnouncement: "",
};

const DEFAULT_MAP_SETTINGS: MapSettings = {
  maxLandmarks: 80,
  maxUnassignedShopMarkers: 40,
  maxMapSnapshots: 50,
  maxEditZoom: 20,
};

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service role env vars are missing.");
  }

  return createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function parsePublicSettings(value: unknown): PublicSettings {
  if (!value || typeof value !== "object") return DEFAULT_PUBLIC_SETTINGS;
  const record = value as Partial<PublicSettings>;
  return {
    siteName: typeof record.siteName === "string" ? record.siteName : DEFAULT_PUBLIC_SETTINGS.siteName,
    maintenanceMode:
      typeof record.maintenanceMode === "boolean"
        ? record.maintenanceMode
        : DEFAULT_PUBLIC_SETTINGS.maintenanceMode,
    maintenanceMessage:
      typeof record.maintenanceMessage === "string"
        ? record.maintenanceMessage
        : DEFAULT_PUBLIC_SETTINGS.maintenanceMessage,
    publicAnnouncementEnabled:
      typeof record.publicAnnouncementEnabled === "boolean"
        ? record.publicAnnouncementEnabled
        : DEFAULT_PUBLIC_SETTINGS.publicAnnouncementEnabled,
    publicAnnouncement:
      typeof record.publicAnnouncement === "string"
        ? record.publicAnnouncement
        : DEFAULT_PUBLIC_SETTINGS.publicAnnouncement,
  };
}

function parseMapSettings(value: unknown): MapSettings {
  if (!value || typeof value !== "object") return DEFAULT_MAP_SETTINGS;
  const record = value as Partial<MapSettings>;
  const readInt = (input: unknown, fallback: number, min: number, max: number) => {
    const next = typeof input === "number" ? Math.round(input) : fallback;
    return Math.min(max, Math.max(min, Number.isFinite(next) ? next : fallback));
  };
  return {
    maxLandmarks: readInt(record.maxLandmarks, DEFAULT_MAP_SETTINGS.maxLandmarks, 1, 500),
    maxUnassignedShopMarkers: readInt(
      record.maxUnassignedShopMarkers,
      DEFAULT_MAP_SETTINGS.maxUnassignedShopMarkers,
      0,
      500
    ),
    maxMapSnapshots: readInt(record.maxMapSnapshots, DEFAULT_MAP_SETTINGS.maxMapSnapshots, 1, 500),
    maxEditZoom: readInt(record.maxEditZoom, DEFAULT_MAP_SETTINGS.maxEditZoom, 18, 24),
  };
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdmin(getRole(user))) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { user, adminClient: createAdminClient() };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { data, error } = await auth.adminClient
      .from("system_settings")
      .select("key, value")
      .in("key", ["public", "map"]);

    if (error) {
      return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
    }

    const publicRow = (data ?? []).find((row) => row.key === "public");
    const mapRow = (data ?? []).find((row) => row.key === "map");

    return NextResponse.json({
      public: parsePublicSettings(publicRow?.value),
      map: parseMapSettings(mapRow?.value),
    });
  } catch {
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "admin-settings-put",
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const body = (await request.json().catch(() => null)) as {
      public?: unknown;
      map?: unknown;
    } | null;

    const publicSettings = parsePublicSettings(body?.public);
    const mapSettings = parseMapSettings(body?.map);

    const { error } = await auth.adminClient.from("system_settings").upsert(
      [
        { key: "public", value: publicSettings, updated_by: auth.user.id },
        { key: "map", value: mapSettings, updated_by: auth.user.id },
      ],
      { onConflict: "key" }
    );

    if (error) {
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, public: publicSettings, map: mapSettings });
  } catch {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
