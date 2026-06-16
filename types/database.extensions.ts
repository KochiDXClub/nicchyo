import type { Database } from "./database.types";

// ── Tables not included in Supabase auto-generated types ──────────────────────
// These must be maintained manually until the next `supabase gen types` run.

export type AdminNotificationRow = {
  id: string;
  created_at: string;
  is_read: boolean;
  type: string | null;
  title: string | null;
  body: string | null;
  link: string | null;
};

export type ShopInteractionInsert = {
  visitor_key?: string | null;
  shop_id: string;
  event_type: string;
  meta?: Record<string, unknown> | null;
  ip_address?: string | null;
};

type ExtendedPublicSchema = Omit<Database["public"], "Tables"> & {
  Tables: Database["public"]["Tables"] & {
    admin_notifications: {
      Row: AdminNotificationRow;
      Insert: Omit<AdminNotificationRow, "id" | "created_at" | "is_read"> & { is_read?: boolean };
      Update: Partial<Omit<AdminNotificationRow, "id" | "created_at">>;
      Relationships: never[];
    };
    shop_interactions: {
      Row: ShopInteractionInsert & { id: string; created_at: string };
      Insert: ShopInteractionInsert;
      Update: Partial<ShopInteractionInsert>;
      Relationships: never[];
    };
  };
};

export type DatabaseWithExtensions = Omit<Database, "public"> & {
  public: ExtendedPublicSchema;
};
