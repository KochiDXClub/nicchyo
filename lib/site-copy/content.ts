import texts from "@/content/site-copy/texts.json";
import faq from "@/content/site-copy/faq.json";

export type SiteCopy = { texts: Record<keyof typeof texts, string>; faq: typeof faq };
export const DEFAULT_SITE_COPY: SiteCopy = { texts, faq };

/** 保存・公開は同じ基準で検証し、未知のキーやHTMLを受け付けない。 */
export function parseSiteCopy(value: unknown): SiteCopy | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { texts?: unknown; faq?: unknown };
  if (!candidate.texts || typeof candidate.texts !== "object" || Array.isArray(candidate.texts) || !Array.isArray(candidate.faq)) return null;
  const input = candidate.texts as Record<string, unknown>;
  const keys = Object.keys(texts);
  if (Object.keys(input).length !== keys.length || keys.some((key) => !(key in input))) return null;
  const validText = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && Array.from(v).length <= max && !/<\/?[a-z!][^>]*>/i.test(v) && (v.match(/\*\*/g)?.length ?? 0) % 2 === 0;
  if (keys.some((key) => !validText(input[key], 2000))) return null;
  if (candidate.faq.length < 1 || candidate.faq.length > 200) return null;
  const seen = new Set<string>();
  for (const item of candidate.faq) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !/^[a-z0-9-]{1,80}$/.test(item.id) || seen.has(item.id) || !["map", "favorites", "account", "general"].includes(item.category) || !validText(item.q, 300) || !validText(item.a, 4000)) return null;
    seen.add(item.id);
  }
  return { texts: input as SiteCopy["texts"], faq: candidate.faq as SiteCopy["faq"] };
}

/** コード側に文言が追加されても、保存済みの値を保持して新規キーだけ初期値で補う。 */
export function resolveSiteCopy(value: unknown): SiteCopy | null {
  if (!value || typeof value !== "object") return null;
  const input = value as { texts?: unknown; faq?: unknown };
  if (!input.texts || typeof input.texts !== "object" || Array.isArray(input.texts)) return null;
  const saved = input.texts as Record<string, unknown>;
  const merged = Object.fromEntries(Object.entries(texts).map(([key, fallback]) => [key, saved[key] ?? fallback]));
  return parseSiteCopy({ texts: merged, faq: input.faq });
}
