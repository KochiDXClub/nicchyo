import { Map, Heart, User, HelpCircle } from "lucide-react";
import faqItems from "@/content/site-copy/faq.json";

export type FaqCategory = "general" | "map" | "favorites" | "account";

export interface FaqItem {
  id: string;
  category: FaqCategory;
  q: string;
  a: string;
}

export const FAQ_CATEGORIES = [
  { id: "all", label: "すべて", icon: null },
  { id: "map", label: "マップ・店舗", icon: Map },
  { id: "favorites", label: "お気に入り", icon: Heart },
  { id: "account", label: "アカウント", icon: User },
  { id: "general", label: "その他", icon: HelpCircle },
] as const;

// 質問と回答はスプレッドシートで編集する（docs/SITE_COPY.md）。カテゴリは取り込み時に検証済み
export const FAQ_DATA = faqItems as FaqItem[];
