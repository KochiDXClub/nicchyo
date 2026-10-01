import { z } from "zod";

/**
 * にちよさんのノート（出店者がにちよさんに教えるお店のこと）。
 * 1枚 = トピックタイトル（「混む時間」「お支払い方法」など、何の話か）+ 本文。
 * 届け先ごとに、どのにちよさんへ渡すかを決める。
 * 保存先は store_knowledge（supabase/migrations/20261001160000_store_knowledge_notes.sql）。
 */

/** トピックタイトルの候補。押すとそのまま入る（自由に書いてもよい） */
export const NOTE_TITLE_SUGGESTIONS = [
  "おすすめ",
  "混む時間",
  "お支払い方法",
  "試食",
  "気をつけること",
] as const;

export const NOTE_TITLE_MAX = 60;
export const NOTE_CONTENT_MAX = 1000;

export type AiNote = {
  id: string;
  /** トピックタイトル（何の話か） */
  title: string;
  content: string;
  /** お客さん向けのにちよさん（相談・店舗ページのチャット）に渡すか */
  forVisitors: boolean;
  /** 出店者本人の使い方相談のにちよさんに渡すか */
  forVendor: boolean;
  /** 検索用のベクトルを作れたか。作れなかったノートは、にちよさんが探せない */
  searchable: boolean;
  updatedAt: string;
};

export type AiSettings = {
  /** お店の数字を、自分の使い方相談に使うか */
  useStatsInVendorHelp: boolean;
  /** よく売れている商品の名前を、お客さんへの案内に使うか（数字は渡さない） */
  sharePopularWithVisitors: boolean;
};

/** 設定の行がまだ無い出店者の既定値（テーブルの既定値と同じ） */
export const DEFAULT_AI_SETTINGS: AiSettings = {
  useStatsInVendorHelp: true,
  sharePopularWithVisitors: false,
};

export const AiNoteInputSchema = z
  .object({
    title: z.string().trim().min(1, "トピックタイトルを入れてください").max(NOTE_TITLE_MAX),
    content: z.string().trim().min(1, "本文を入れてください").max(NOTE_CONTENT_MAX),
    forVisitors: z.boolean(),
    forVendor: z.boolean(),
  })
  // どのにちよさんにも渡さないノートは、書いても使われない
  .refine((note) => note.forVisitors || note.forVendor, {
    message: "届け先を1つ以上選んでください",
    path: ["forVisitors"],
  });

export type AiNoteInput = z.infer<typeof AiNoteInputSchema>;

export const AiSettingsSchema = z.object({
  useStatsInVendorHelp: z.boolean(),
  sharePopularWithVisitors: z.boolean(),
});

/**
 * 検索用のベクトルにする文章。トピックタイトルと本文をつなげると、
 * 「お支払い方法」のようにトピックタイトルにしか出てこない言葉でも見つかるようになる。
 */
export function noteEmbeddingText(note: Pick<AiNoteInput, "title" | "content">): string {
  return `${note.title}\n${note.content}`;
}

export type StoreKnowledgeRow = {
  id: string;
  title: string;
  content: string;
  for_visitors: boolean;
  for_vendor: boolean;
  has_embedding: boolean;
  updated_at: string;
};

export function rowToAiNote(row: StoreKnowledgeRow): AiNote {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    forVisitors: row.for_visitors,
    forVendor: row.for_vendor,
    searchable: row.has_embedding,
    updatedAt: row.updated_at,
  };
}
