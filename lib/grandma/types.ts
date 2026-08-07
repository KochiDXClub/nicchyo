import type { ConsultCharacterId } from "@/app/(public)/consult/data/consultCharacters";
import type { ConsultHistoryEntry, ConsultTurn } from "@/app/(public)/consult/types/consultConversation";

export type VendorRow = {
  id: string;
  shop_name: string | null;
  strength: string | null;
  style: string | null;
  style_tags: string[] | null;
  category_id: string | null;
  categories: { name: string | null }[] | { name: string | null } | null;
  main_products: string[] | null;
  main_product_prices: Record<string, number | null> | null;
  payment_methods: string[] | null;
  rain_policy: string | null;
  schedule: string[] | null;
};

export type ProductRow = {
  vendor_id: string | null;
  name: string | null;
};

export type LocationRow = {
  id: string;
  store_number: number | null;
  latitude: number | null;
  longitude: number | null;
  district: string | null;
};

export type AssignmentRow = {
  vendor_id: string | null;
  location_id: string | null;
  market_date: string | null;
};

export type ActiveContentRow = {
  vendor_id: string | null;
  body: string | null;
  image_url: string | null;
  expires_at: string;
  created_at: string;
};

export type KnowledgeRow = {
  id: string;
  category: string | null;
  title: string | null;
  content: string | null;
  image_url: string | null;
};

export type SeasonalProductRow = {
  vendorId: string;
  shopName: string;
  productName: string;
  seasonName: string;
};

export type ParsedRequest = {
  text: string;
  location: { lat: number; lng: number } | null;
  imageDataUrl: string | null;
  targetShopId: number | null;
  targetShopName: string | null;
  history: ConsultHistoryEntry[];
  memorySummary: string;
  preferredCharacterId: ConsultCharacterId | null;
  visitorKey: string | null;
  stream: boolean;
};

export type StructuredConsultResponse = {
  summary: string;
  turns: { speakerId: ConsultCharacterId; text: string }[];
  shopIds: number[];
  imageUrl: string | null;
  followUpQuestion: string;
};

export type StreamedConsultPayload = {
  summary: string;
  turns: ConsultTurn[];
  shopIds: number[];
  imageUrl: string | null;
  followUpQuestion: string;
};

export type ConversationPattern = {
  id: "pattern1" | "pattern2" | "pattern3" | "pattern4" | "all_cast";
  instruction: string;
  turnCount: number;
};
