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

// vendor_inquiries / vendor_inquiry_replies
// supabase/migrations/20260830100000_create_vendor_inquiries.sql 参照。
// マイグレーションがdevelopにマージされ次第、`supabase gen types` で生成される型に置き換える。
export type VendorInquiryTopic = "question" | "report" | "consultation";
export type VendorInquiryCategory = "city" | "operator" | "both";
export type VendorInquiryUrgency = "low" | "normal" | "high";

export type VendorInquiryRow = {
  id: string;
  vendor_id: string | null;
  topic: VendorInquiryTopic;
  category: VendorInquiryCategory;
  urgency: VendorInquiryUrgency;
  body: string;
  image_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type VendorInquiryInsert = Pick<VendorInquiryRow, "topic" | "category" | "body"> &
  Partial<Pick<VendorInquiryRow, "id" | "vendor_id" | "urgency" | "image_url" | "status" | "created_at" | "updated_at">>;

export type VendorInquiryUpdate = Partial<Omit<VendorInquiryRow, "id" | "created_at">>;

export type VendorInquiryReplySenderRole = "vendor" | "operator" | "city";

export type VendorInquiryReplyRow = {
  id: string;
  inquiry_id: string;
  sender_role: VendorInquiryReplySenderRole;
  sender_id: string | null;
  body: string;
  created_at: string;
};

export type VendorInquiryReplyInsert = Pick<VendorInquiryReplyRow, "inquiry_id" | "sender_role" | "body"> &
  Partial<Pick<VendorInquiryReplyRow, "id" | "sender_id" | "created_at">>;

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
    vendor_inquiries: {
      Row: VendorInquiryRow;
      Insert: VendorInquiryInsert;
      Update: VendorInquiryUpdate;
      Relationships: never[];
    };
    vendor_inquiry_replies: {
      Row: VendorInquiryReplyRow;
      Insert: VendorInquiryReplyInsert;
      Update: Partial<VendorInquiryReplyRow>;
      Relationships: never[];
    };
  };
};

export type DatabaseWithExtensions = Omit<Database, "public"> & {
  public: ExtendedPublicSchema;
};
