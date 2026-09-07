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

export type AiPromptRow = {
  id: string;
  key: string;
  body: string;
  version: number;
  is_active: boolean;
  note: string | null;
  updated_by: string | null;
  created_at: string;
};

export type AiModelRow = {
  id: string;
  label: string;
  description: string;
  token_param: "max_tokens" | "max_completion_tokens";
  supports_temperature: boolean;
  reasoning_efforts: string[];
  reasoning_headroom_tokens: number;
  price_input_per_mtok: number;
  price_output_per_mtok: number;
  is_selectable: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type AiUseCaseRow = {
  key: string;
  label: string;
  description: string;
  model_id: string | null;
  reasoning_effort: string | null;
  is_enabled: boolean;
  sort_order: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AiConversationSettingRow = {
  key: string;
  label: string;
  description: string;
  value: number;
  min_value: number;
  max_value: number;
  sort_order: number;
  updated_by: string | null;
  updated_at: string;
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
    ai_conversation_settings: {
      Row: AiConversationSettingRow;
      // 行を足しても新しい設定は生まれない（値を読むのはコード側）。
      // 設定の追加はマイグレーションとコードの対応が要るので insert は塞ぐ
      Insert: never;
      // 見出し・説明・上下限はマイグレーションが正本。運営が変えるのは値だけ
      Update: Partial<Pick<AiConversationSettingRow, "value" | "updated_by">>;
      Relationships: never[];
    };
    ai_prompts: {
      Row: AiPromptRow;
      // version はトリガ（ai_prompts_activate_new_version）が採番するので送らない。
      // is_active も型で塞ぐ（false を送るとトリガの切り替えが走らず、
      // そのキーのアクティブ行が消えて既定値に落ちた状態を作れてしまう）
      Insert: Pick<AiPromptRow, "key" | "body"> &
        Partial<Pick<AiPromptRow, "note" | "updated_by">>;
      Update: Partial<Pick<AiPromptRow, "is_active" | "note">>;
      Relationships: never[];
    };
    ai_models: {
      Row: AiModelRow;
      // モデル台帳の追加・変更はマイグレーションで行う。APIから書かせない。
      // 能力の列を間違えると、そのモデルを使う機能の全リクエストが落ちる
      Insert: never;
      Update: never;
      Relationships: never[];
    };
    ai_use_cases: {
      Row: AiUseCaseRow;
      // 機能の追加はマイグレーションで行う。APIから作らせない
      // （行を足してもコード側に呼び出しが無ければ何も起きないため）
      Insert: never;
      // 運営が変えられるのは「どのモデルを当てるか」だけ
      Update: Partial<Pick<AiUseCaseRow, "model_id" | "reasoning_effort" | "updated_by">>;
      Relationships: never[];
    };
  };
};

export type DatabaseWithExtensions = Omit<Database, "public"> & {
  public: ExtendedPublicSchema;
};
