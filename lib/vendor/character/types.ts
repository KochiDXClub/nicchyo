// お店のAIキャラクター（モック段階）。
// 来訪者がお店でAIに聞くとき、ここで決めたキャラが答える想定。
// 保存先（DB）・運営の審査画面は未実装。型だけ先に固めておく。

export type TemplateCharacter = {
  id: string;
  name: string;
  /** 一言の紹介（カードに出す） */
  tagline: string;
  /** 話し方のタグ（カードに出す） */
  tags: readonly string[];
  /** 画像が無いキャラは頭文字の丸で出す */
  image?: string;
  /** 話し方の見本。テンプレは世界観をそろえるため、出店者は変えられない */
  greeting: string;
  samples: readonly string[];
};

export type OriginalCharacterDraft = {
  name: string;
  /** 出店者が用意したイラスト（モックでは端末内の一時 URL） */
  illustrationUrl: string | null;
  /** 一人称（わし、うち、ぼく…） */
  firstPerson: string;
  /** 語尾・口ぐせ（〜じゃき、〜ぜよ…） */
  ending: string;
  /** 話し方・性格の自由記述 */
  speechNote: string;
};

/** 運営の確認の状態。オリジナルは approved になるまでお客さんには出ない */
export type ReviewStatus =
  | { state: "draft" }
  | { state: "pending"; submittedAt: string }
  | { state: "approved"; reviewedAt: string }
  | { state: "rejected"; reviewedAt: string; reason: string };

export const EMPTY_DRAFT: OriginalCharacterDraft = {
  name: "",
  illustrationUrl: null,
  firstPerson: "",
  ending: "",
  speechNote: "",
};

/** 申請に必要なものが揃っているか。足りないものを日本語で返す */
export function missingForSubmit(draft: OriginalCharacterDraft): string[] {
  const missing: string[] = [];
  if (!draft.illustrationUrl) missing.push("イラスト");
  if (!draft.name.trim()) missing.push("名前");
  if (!draft.speechNote.trim() && !draft.ending.trim()) missing.push("話し方（語尾か、話し方のメモ）");
  return missing;
}
