// 近況の一覧を投稿時期で区切るためのバケット。
// 日曜市は週次開催なので、週単位で区切る。

export type StoryAgeBucket = "this_week" | "last_week" | "older";

// 表示順（新しい順）。一覧のセクション並びに使う。
export const STORY_AGE_ORDER: StoryAgeBucket[] = ["this_week", "last_week", "older"];

export const STORY_AGE_LABEL: Record<StoryAgeBucket, string> = {
  this_week: "今週",
  last_week: "先週",
  older: "それより前",
};

const DAY_MS = 86_400_000;

/** created_at（ISO文字列）からバケットを求める。7日未満=今週, 14日未満=先週, それ以降=それより前。 */
export function getStoryAgeBucket(createdAt: string, now: number = Date.now()): StoryAgeBucket {
  const days = (now - new Date(createdAt).getTime()) / DAY_MS;
  if (days < 7) return "this_week";
  if (days < 14) return "last_week";
  return "older";
}
