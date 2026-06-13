import { safeJsonParse } from "./utils/safeJsonParse";

export type KotoduteNote = {
  id: string;
  shopId: number | "all";
  text: string;
  createdAt: number;
  authorEmoji?: string;
};

const STORAGE_KEY = "nicchyo-kotodute-notes";
export const KOTODUTE_UPDATED_EVENT = "nicchyo-kotodute-updated";

const seed: KotoduteNote[] = [
  {
    id: "seed-1",
    shopId: 12,
    text: "朝どれナスが甘い！#12",
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: "seed-2",
    shopId: "all",
    text: "雨の日は全体的に値下げしてました #all",
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
  },
  {
    id: "seed-3",
    shopId: 45,
    text: "カツオのたたきが香ばしい！#45",
    createdAt: Date.now() - 1000 * 60 * 60 * 10,
  },
];

function sanitizeNote(raw: unknown): KotoduteNote | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;

  const id = typeof r.id === "string" && r.id ? r.id : null;
  const text = typeof r.text === "string" ? r.text : null;
  const createdAt = typeof r.createdAt === "number" && isFinite(r.createdAt) ? r.createdAt : null;
  if (!id || !text || createdAt === null) return null;

  // shopId は number(正整数) か "all" のみ許可
  const rawShopId = r.shopId;
  const shopId: number | "all" =
    rawShopId === "all"
      ? "all"
      : typeof rawShopId === "number" && Number.isInteger(rawShopId) && rawShopId > 0
        ? rawShopId
        : "all";

  const authorEmoji =
    typeof r.authorEmoji === "string" && /^\p{Emoji}/u.test(r.authorEmoji)
      ? r.authorEmoji
      : undefined;

  return { id, shopId, text, createdAt, authorEmoji };
}

export function loadKotodute(): KotoduteNote[] {
  if (typeof window === "undefined") return seed;
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = safeJsonParse<unknown[]>(raw, []);
  if (!Array.isArray(parsed) || parsed.length === 0) return seed;
  const notes = parsed.map(sanitizeNote).filter((n): n is KotoduteNote => n !== null);
  return notes.length > 0 ? notes : seed;
}

export function saveKotodute(notes: KotoduteNote[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  window.dispatchEvent(new Event(KOTODUTE_UPDATED_EVENT));
}
