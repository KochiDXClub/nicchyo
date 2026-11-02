/**
 * 本番デプロイ専用の既定値を、ページ公開設定に重ねる
 *
 * 本番マップを「準備中」にしている間、管理者以外には店舗データを見せない。
 * 既定値はレジストリ（productionDefault）に書き、DB に保存された設定があればそちらが勝つ。
 * Preview・開発では何も足さない（今までどおり全ページ公開）。
 *
 * DB（system_settings）は Preview と本番で共有されうるので、本番の既定そのものは DB に書かない。
 * 保存時は normalizeForSave で「その環境の既定と同じ値」を落とす。落とす向きは必ず厳しい側
 * （Preview から保存しても、本番の public 上書きを足すことはない）。
 */

import { PAGE_REGISTRY } from "./registry";
import { DEFAULT_REDIRECT_TO, VISIBILITY_ROLES, type PageVisibilitySettings } from "./types";

/**
 * 本番の既定を適用する環境か。
 * VERCEL_ENV=production は Vercel の本番デプロイだけで立つ。
 * NICCHYO_PRODUCTION_DEFAULTS=1 はローカルや Preview で本番の挙動を確かめる用（既定では未設定）。
 */
export function usesProductionDefaults(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === "production" || env.NICCHYO_PRODUCTION_DEFAULTS === "1";
}

/** 保存済みの設定に本番の既定を重ねる。本番でなければそのまま返す */
export function applyEnvironmentDefaults(
  settings: PageVisibilitySettings,
  production: boolean = usesProductionDefaults()
): PageVisibilitySettings {
  if (!production) return settings;

  const pages = { ...settings.pages };
  for (const entry of PAGE_REGISTRY) {
    if (!entry.productionDefault) continue;
    const stored = pages[entry.path];
    pages[entry.path] = {
      ...stored,
      roles: { ...entry.productionDefault, ...stored?.roles },
      redirectTo: stored?.redirectTo ?? DEFAULT_REDIRECT_TO,
    };
  }
  return { pages };
}

/**
 * 管理画面から保存するとき、その環境の既定と同じ値を落とす。
 * 本番: 既定（private）と同じ値は書かない。Preview: 既定（public）と同じ値は書かない。
 * これで本番の保存が Preview の挙動を変えず、Preview の保存が本番の既定を緩めることもない。
 */
export function normalizeForSave(
  settings: PageVisibilitySettings,
  production: boolean = usesProductionDefaults()
): PageVisibilitySettings {
  const pages: PageVisibilitySettings["pages"] = {};
  for (const [path, rule] of Object.entries(settings.pages)) {
    const entry = PAGE_REGISTRY.find((e) => e.path === path);
    const roles: typeof rule.roles = {};
    for (const role of VISIBILITY_ROLES) {
      const state = rule.roles[role];
      if (state === undefined) continue;
      const baseline = (production ? entry?.productionDefault?.[role] : undefined) ?? "public";
      if (state !== baseline) roles[role] = state;
    }
    const next = { ...rule, roles };
    if (Object.keys(roles).length > 0 || next.redirectTo) pages[path] = next;
  }
  return { pages };
}
