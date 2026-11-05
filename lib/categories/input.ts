import { CATEGORY_NAME_MAX, parseCategoryNameEn } from "./translate";

export type CategoryInputResult =
  | { ok: true; name: string; nameEn: string | null }
  | { ok: false; error: string };

/** カテゴリーの作成・更新の入力（日本語名と英語名）を検証する。作成と更新の API で共通 */
export function parseCategoryInput(body: { name?: string; nameEn?: unknown }): CategoryInputResult {
  const name = (body.name ?? "").trim();
  if (!name || name.length > CATEGORY_NAME_MAX) {
    return { ok: false, error: `カテゴリ名は1〜${CATEGORY_NAME_MAX}文字で入力してください` };
  }
  const nameEn = parseCategoryNameEn(body.nameEn);
  if (nameEn === undefined) return { ok: false, error: "英語名は100文字以内で入力してください" };
  return { ok: true, name, nameEn };
}
