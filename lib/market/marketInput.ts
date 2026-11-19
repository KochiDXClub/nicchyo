/**
 * 市の登録・編集の入力を検証する。コードを変えずに市を作れるよう、管理画面からの値はここで必ず確かめる。
 * 曜日は 0=日〜6=土（PostgreSQL の extract(dow) と同じ）。
 */

export type MarketInput = {
  name: string;
  slug: string;
  weekday: number;
  isPublic: boolean;
};

export type MarketInputResult = { ok: true; data: MarketInput } | { ok: false; error: string };

const SLUG_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;

export function parseMarketInput(raw: unknown): MarketInputResult {
  if (!raw || typeof raw !== "object") return { ok: false, error: "入力が正しくありません" };
  const body = raw as Record<string, unknown>;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 40) return { ok: false, error: "市の名前は1〜40文字で入力してください" };

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!SLUG_PATTERN.test(slug)) {
    return { ok: false, error: "公開URLの名前は英小文字で始まる2〜32文字（英小文字・数字・ハイフン）にしてください" };
  }

  const weekday = body.weekday;
  if (typeof weekday !== "number" || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return { ok: false, error: "開催曜日は0（日）〜6（土）で指定してください" };
  }

  if (body.isPublic !== undefined && typeof body.isPublic !== "boolean") {
    return { ok: false, error: "公開の指定が正しくありません" };
  }

  return { ok: true, data: { name, slug, weekday, isPublic: body.isPublic === true } };
}
