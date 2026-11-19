import type { Database } from "@/types/database.types";

export type PeopleIllustration = Database["public"]["Tables"]["map_people_illustrations"]["Row"];
export type PeopleIllustrationInput = Omit<PeopleIllustration, "id">;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isIllustrationId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isIllustrationImageUrl(value: string): boolean {
  if (!value || value.length > 500 || /[\x00-\x20\x7f\\]/.test(value)) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function parsePeopleIllustration(body: Record<string, unknown>): PeopleIllustrationInput | string {
  const { market_id, latitude, longitude, width_px, enabled } = body;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const image_url = typeof body.image_url === "string" ? body.image_url.trim() : "";

  if (!name || name.length > 80) return "管理用の名前は1〜80文字で入力してください";
  if (!isIllustrationId(market_id)) return "表示する市を選んでください";
  if (!isIllustrationImageUrl(image_url)) return "画像はサイト内のパスか HTTPS のURLを指定してください";
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < 33.4 || latitude > 33.7) {
    return "緯度が高知市の範囲外です";
  }
  if (typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < 133.4 || longitude > 133.7) {
    return "経度が高知市の範囲外です";
  }
  if (typeof width_px !== "number" || !Number.isInteger(width_px) || width_px < 16 || width_px > 200) {
    return "幅は16〜200pxの整数で入力してください";
  }
  if (typeof enabled !== "boolean") return "表示設定が無効です";

  return { name, market_id, image_url, latitude, longitude, width_px, enabled };
}
