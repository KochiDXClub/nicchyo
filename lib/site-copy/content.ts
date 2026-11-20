import texts from "@/content/site-copy/texts.json";
import faq from "@/content/site-copy/faq.json";

export type SiteCopyKey = keyof typeof texts;
/**
 * 英語の文言（管理画面で編集・AI で英訳）。`source` は、この英訳を書いたときの日本語の原文。
 * 日本語の原文が後から変わったら source と合わなくなるので、来訪者には日本語を出す（古い英訳を出さないため）。
 */
export type SiteEnglishEntry = { text: string; source: string };
export type SiteEnglish = { texts: Partial<Record<SiteCopyKey, SiteEnglishEntry>> };
export type SiteCopy = { texts: Record<SiteCopyKey, string>; faq: typeof faq; en?: SiteEnglish };
export const DEFAULT_SITE_COPY: SiteCopy = { texts, faq };

const MAX_TEXT_LENGTH = 2000;

/** 文言の検証。HTML・空欄・長すぎる文・** の対が崩れたものを拒否する */
function isValidText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && Array.from(value).length <= max && !/<\/?[a-z!][^>]*>/i.test(value) && (value.match(/\*\*/g)?.length ?? 0) % 2 === 0;
}

/** 保存時の英語の検証。未知のキーや不正な値があれば null（保存を拒否する） */
function parseEnglish(value: unknown): SiteEnglish | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = (value as { texts?: unknown }).texts;
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) return null;
  const out: SiteEnglish["texts"] = {};
  for (const [key, entry] of Object.entries(entries as Record<string, unknown>)) {
    if (!(key in texts) || !entry || typeof entry !== "object") return null;
    const { text, source } = entry as { text?: unknown; source?: unknown };
    if (!isValidText(text, MAX_TEXT_LENGTH) || !isValidText(source, MAX_TEXT_LENGTH)) return null;
    out[key as SiteCopyKey] = { text, source };
  }
  return { texts: out };
}

/**
 * 読み出し用。保存済みの英語のうち、今も有効なものだけを残す（消えたキーや壊れた項目は捨てて、残りは使う）。
 * 英語が壊れていても日本語の公開版まで初期値に戻さないため、ここでは拒否しない。
 */
function keepValidEnglish(value: unknown): SiteEnglish | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = (value as { texts?: unknown }).texts;
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) return undefined;
  const out: SiteEnglish["texts"] = {};
  for (const [key, entry] of Object.entries(entries as Record<string, unknown>)) {
    if (!(key in texts) || !entry || typeof entry !== "object") continue;
    const { text, source } = entry as { text?: unknown; source?: unknown };
    if (isValidText(text, MAX_TEXT_LENGTH) && isValidText(source, MAX_TEXT_LENGTH)) out[key as SiteCopyKey] = { text, source };
  }
  return Object.keys(out).length > 0 ? { texts: out } : undefined;
}

/** 保存・公開は同じ基準で検証し、未知のキーやHTMLを受け付けない。 */
export function parseSiteCopy(value: unknown): SiteCopy | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { texts?: unknown; faq?: unknown; en?: unknown };
  if (!candidate.texts || typeof candidate.texts !== "object" || Array.isArray(candidate.texts) || !Array.isArray(candidate.faq)) return null;
  const input = candidate.texts as Record<string, unknown>;
  const keys = Object.keys(texts);
  if (Object.keys(input).length !== keys.length || keys.some((key) => !(key in input))) return null;
  if (keys.some((key) => !isValidText(input[key], 2000))) return null;
  if (candidate.faq.length < 1 || candidate.faq.length > 200) return null;
  const seen = new Set<string>();
  for (const item of candidate.faq) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !/^[a-z0-9-]{1,80}$/.test(item.id) || seen.has(item.id) || !["map", "favorites", "account", "general"].includes(item.category) || !isValidText(item.q, 300) || !isValidText(item.a, 4000)) return null;
    seen.add(item.id);
  }
  const base: SiteCopy = { texts: input as SiteCopy["texts"], faq: candidate.faq as SiteCopy["faq"] };
  if (candidate.en === undefined || candidate.en === null) return base;
  const en = parseEnglish(candidate.en);
  return en ? { ...base, en } : null;
}

/** コード側に文言が追加されても、保存済みの値を保持して新規キーだけ初期値で補う。 */
export function resolveSiteCopy(value: unknown): SiteCopy | null {
  if (!value || typeof value !== "object") return null;
  const input = value as { texts?: unknown; faq?: unknown; en?: unknown };
  if (!input.texts || typeof input.texts !== "object" || Array.isArray(input.texts)) return null;
  const saved = input.texts as Record<string, unknown>;
  const merged = Object.fromEntries(Object.entries(texts).map(([key, fallback]) => [key, saved[key] ?? fallback]));
  const base = parseSiteCopy({ texts: merged, faq: input.faq });
  if (!base) return null;
  const en = keepValidEnglish(input.en);
  return en ? { ...base, en } : base;
}
