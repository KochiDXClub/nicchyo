// ストーリー（近況）の鮮度バケット。新しいものほど鮮やかに、古いものほど
// 退色（グレースケール）させることで「今の在庫ではないかも」という鮮度の
// シグナルを兼ねる。日曜市は週次開催のため、週単位で区切る。

export type StoryAgeBucket = "this_week" | "last_week" | "last_month";

// 表示順（新しい順）。グリッドのセクション並びに使う。
export const STORY_AGE_ORDER: StoryAgeBucket[] = ["this_week", "last_week", "last_month"];

export const STORY_AGE_LABEL: Record<StoryAgeBucket, string> = {
  this_week: "今週",
  last_week: "1週間前",
  last_month: "1か月前",
};

// 古いほど退色させる Tailwind クラス。黒背景のビューアでも破綻しないよう
// 不透明度は下げず、彩度（grayscale）のみで表現する。
export const STORY_AGE_IMAGE_CLASS: Record<StoryAgeBucket, string> = {
  this_week: "",
  last_week: "grayscale-[0.5]",
  last_month: "grayscale",
};

const DAY_MS = 86_400_000;

/** created_at（ISO文字列）から鮮度バケットを求める。7日未満=今週, 14日未満=1週間前, それ以降=1か月前。 */
export function getStoryAgeBucket(createdAt: string, now: number = Date.now()): StoryAgeBucket {
  const days = (now - new Date(createdAt).getTime()) / DAY_MS;
  if (days < 7) return "this_week";
  if (days < 14) return "last_week";
  return "last_month";
}
