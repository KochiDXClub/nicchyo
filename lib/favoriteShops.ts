import { safeJsonParse } from "./utils/safeJsonParse";

export const FAVORITE_SHOPS_KEY = "nicchyo-favorite-shops";
export const FAVORITE_SHOPS_UPDATED_EVENT = "nicchyo-favorite-shops-updated";

/**
 * お気に入り1件分。店だけを入れた場合は product が null になり、
 * 商品を入れた場合はその商品名が入る。
 * 同じ店に「店ごと」と「商品」の行が同居することがある。
 */
export type FavoriteEntry = {
  shopId: number;
  /** 商品名。null なら「店ごと」のお気に入り */
  product: string | null;
  /** 追加した時刻（epoch ミリ秒）。並び順に使う */
  addedAt: number;
};

/** 一意キー。同じ店の同じ商品を二重に入れないために使う */
export function favoriteEntryKey(shopId: number, product: string | null): string {
  return `${shopId}:${product ?? ""}`;
}

function normalizeProduct(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * 追加時刻が分からない行に入れる値。
 *
 * ここで Date.now() を入れてはいけない。旧形式のまま使っている利用者は
 * 書き戻しが起きるまで読み込みのたびに変換を通るので、読むたびに
 * 「追加した時刻」が今になってしまい、「追加順」の並びが毎回変わる。
 * 分からないものは「いちばん古い」に倒して、並びを安定させる。
 */
const UNKNOWN_ADDED_AT = 0;

/**
 * 旧形式（number[]）を新形式に読み替える。
 * 保存済みデータを書き換えるのは次の保存時なので、ここでは変換するだけにする。
 *
 * 追加時刻は保存されていないが、保存順は「先に入れたものが前」なので、
 * その並びだけは残す（添字を足して昇順にする）。
 */
function migrateLegacyIds(value: unknown[]): FavoriteEntry[] {
  const seen = new Set<number>();
  const entries: FavoriteEntry[] = [];
  for (const raw of value) {
    if (typeof raw !== "number" && typeof raw !== "string") continue;
    const shopId = Number(raw);
    if (!Number.isFinite(shopId) || seen.has(shopId)) continue;
    seen.add(shopId);
    entries.push({ shopId, product: null, addedAt: UNKNOWN_ADDED_AT + entries.length });
  }
  return entries;
}

function normalizeEntries(value: unknown): FavoriteEntry[] {
  if (!Array.isArray(value)) return [];
  // 旧形式（number[]）は、行が object でないことで見分ける。
  // null は「新形式の行ではない」ので旧形式側に倒し、中で捨てる
  // （ここで新形式扱いにすると、null が1つ混ざっただけで全部消える）
  const looksLegacy = value.every((item) => typeof item !== "object" || item === null);
  if (looksLegacy) return migrateLegacyIds(value);

  const seen = new Set<string>();
  const entries: FavoriteEntry[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const record = raw as Record<string, unknown>;
    const shopId = Number(record.shopId);
    if (!Number.isFinite(shopId)) continue;
    const product = normalizeProduct(record.product);
    const key = favoriteEntryKey(shopId, product);
    if (seen.has(key)) continue;
    seen.add(key);
    const addedAt = Number(record.addedAt);
    entries.push({
      shopId,
      product,
      addedAt: Number.isFinite(addedAt) ? addedAt : UNKNOWN_ADDED_AT,
    });
  }
  return entries;
}

export function loadFavoriteEntries(): FavoriteEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(FAVORITE_SHOPS_KEY);
  return normalizeEntries(safeJsonParse<unknown>(raw, []));
}

export function saveFavoriteEntries(entries: FavoriteEntry[]): FavoriteEntry[] {
  if (typeof window === "undefined") return [];
  const normalized = normalizeEntries(entries);
  localStorage.setItem(FAVORITE_SHOPS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(FAVORITE_SHOPS_UPDATED_EVENT, { detail: normalized }));
  return normalized;
}

/**
 * ハートの点灯判定。マップ・検索結果・店舗詳細で意味を揃えるため、
 * 「その店の行が1つでもあれば点灯」に統一する。
 */
export function isShopFavorited(entries: FavoriteEntry[], shopId: number): boolean {
  return entries.some((entry) => entry.shopId === shopId);
}

export function isProductFavorited(
  entries: FavoriteEntry[],
  shopId: number,
  product: string,
): boolean {
  const normalized = normalizeProduct(product);
  if (normalized === null) return false;
  return entries.some((entry) => entry.shopId === shopId && entry.product === normalized);
}

/** その店にぶら下がっている商品名。店ごとの行（product: null）は含まない */
export function getFavoriteProductsForShop(
  entries: FavoriteEntry[],
  shopId: number,
): string[] {
  return entries
    .filter((entry) => entry.shopId === shopId && entry.product !== null)
    .map((entry) => entry.product as string);
}

export type FavoriteShopGroup = {
  shopId: number;
  products: string[];
  /** その店で最初にお気に入りへ入れた時刻 */
  addedAt: number;
};

/** 一覧表示用。店ごとにまとめ、最近入れた店から並べる */
export function groupFavoritesByShop(entries: FavoriteEntry[]): FavoriteShopGroup[] {
  const groups = new Map<number, FavoriteShopGroup>();
  for (const entry of entries) {
    const group = groups.get(entry.shopId);
    if (group) {
      if (entry.product !== null) group.products.push(entry.product);
      group.addedAt = Math.min(group.addedAt, entry.addedAt);
    } else {
      groups.set(entry.shopId, {
        shopId: entry.shopId,
        products: entry.product === null ? [] : [entry.product],
        addedAt: entry.addedAt,
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.addedAt - a.addedAt);
}

/**
 * 店のハート。消灯→点灯なら「店ごと」の行を足し、
 * 点灯→消灯ならその店の行をすべて消す（商品も一緒に消える）。
 * 商品がぶら下がっているときに確認を出すかどうかは呼び出し側で決める。
 */
export function toggleFavoriteShop(shopId: number): FavoriteEntry[] {
  const current = loadFavoriteEntries();
  const next = isShopFavorited(current, shopId)
    ? current.filter((entry) => entry.shopId !== shopId)
    : [...current, { shopId, product: null, addedAt: Date.now() }];
  return saveFavoriteEntries(next);
}

/** 商品のハート。その商品の行だけを足す／消す */
export function toggleFavoriteProduct(shopId: number, product: string): FavoriteEntry[] {
  const normalized = normalizeProduct(product);
  if (normalized === null) return loadFavoriteEntries();

  const current = loadFavoriteEntries();
  const next = isProductFavorited(current, shopId, normalized)
    ? current.filter((entry) => !(entry.shopId === shopId && entry.product === normalized))
    : [...current, { shopId, product: normalized, addedAt: Date.now() }];
  return saveFavoriteEntries(next);
}

/** その店の行をすべて消す。確認ダイアログのあとで呼ぶ */
export function removeFavoriteShop(shopId: number): FavoriteEntry[] {
  const current = loadFavoriteEntries();
  return saveFavoriteEntries(current.filter((entry) => entry.shopId !== shopId));
}

// ─── 旧バッグ（買い物リスト）からの移行 ──────────────────────────────────────

/** 旧バッグの保存キー。バッグ機能の撤去後も、移行のためだけに読む */
export const LEGACY_BAG_STORAGE_KEY = "nicchyo-fridge-items";
/** 移行を1回だけ走らせるための印 */
export const BAG_MIGRATION_FLAG_KEY = "nicchyo-favorites-bag-migrated";

export type BagMigrationResult = {
  /** お気に入りに取り込んだ商品の数 */
  migrated: number;
  /** どの店のものか分からず取り込めなかった数 */
  skipped: number;
};

/**
 * 旧バッグの中身をお気に入りへ1回だけ移す。
 *
 * 店が分かるもの（fromShopId がある）だけを `{ shopId, product }` として取り込む。
 * 店が分からないものは地図に出せないので取り込めないが、黙って全部消すよりはよい。
 * 移行済みの印を立てるので、2回目以降は何もしない（利用者が外したものが復活しない）。
 *
 * 戻り値が null なら「移行済み、またはブラウザ外」で、何もしていない。
 */
export function migrateBagItemsToFavorites(): BagMigrationResult | null {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem(BAG_MIGRATION_FLAG_KEY)) return null;

  const raw = localStorage.getItem(LEGACY_BAG_STORAGE_KEY);
  const items = safeJsonParse<unknown>(raw, []);
  if (!Array.isArray(items) || items.length === 0) {
    localStorage.setItem(BAG_MIGRATION_FLAG_KEY, "1");
    return { migrated: 0, skipped: 0 };
  }

  const current = loadFavoriteEntries();
  const seen = new Set(current.map((entry) => favoriteEntryKey(entry.shopId, entry.product)));
  const added: FavoriteEntry[] = [];
  const now = Date.now();
  let skipped = 0;

  for (const item of items) {
    if (typeof item !== "object" || item === null) {
      skipped += 1;
      continue;
    }
    const record = item as Record<string, unknown>;
    const product = normalizeProduct(record.name);
    const shopId = Number(record.fromShopId);
    if (product === null || !Number.isFinite(shopId)) {
      skipped += 1;
      continue;
    }
    const key = favoriteEntryKey(shopId, product);
    if (seen.has(key)) continue;
    seen.add(key);
    added.push({ shopId, product, addedAt: now });
  }

  // 印は保存が通ってから立てる。先に立てると、保存に失敗した（容量超過や
  // プライベートブラウズなど）ときに、バッグの中身が移らないまま二度と
  // 移行が走らなくなる
  if (added.length > 0) saveFavoriteEntries([...current, ...added]);
  localStorage.setItem(BAG_MIGRATION_FLAG_KEY, "1");
  return { migrated: added.length, skipped };
}

/** 旧バッグの買い物チェックリスト。お気に入りには持ち込まないので消すだけ */
export const LEGACY_SHOPPING_CHECKED_KEY = "nicchyo-shopping-checked";

/**
 * バッグ撤去後に残る、お気に入りへ持ち込まない保存物を消す。
 *
 * 買い物チェックリストは「どれを買い終えたか」の印で、店にも商品にも紐づかない
 * ため移行先がない。移行元の nicchyo-fridge-items は残す（移行に失敗していた
 * ときの控えになるので、こちらから消しにいかない）。
 */
export function clearLegacyShoppingChecklist(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_SHOPPING_CHECKED_KEY);
}

// ─── 既存UI向けの互換API ──────────────────────────────────────────────────────
// 店単位のハートしか扱わない画面（検索・マップ）はこちらを使い続けられる。
// 商品対応の画面が出そろったら段階的に上のAPIへ寄せる。

export function loadFavoriteShopIds(): number[] {
  return Array.from(new Set(loadFavoriteEntries().map((entry) => entry.shopId)));
}

/**
 * 指定した店だけが残るように置き換える。
 * 残す店にぶら下がっていた商品は保持する。
 */
export function saveFavoriteShopIds(ids: number[]): void {
  if (typeof window === "undefined") return;
  const current = loadFavoriteEntries();
  const now = Date.now();
  const kept: FavoriteEntry[] = [];
  const seen = new Set<number>();
  for (const raw of ids ?? []) {
    const shopId = Number(raw);
    if (!Number.isFinite(shopId) || seen.has(shopId)) continue;
    seen.add(shopId);
    const existing = current.filter((entry) => entry.shopId === shopId);
    if (existing.length > 0) kept.push(...existing);
    else kept.push({ shopId, product: null, addedAt: now });
  }
  saveFavoriteEntries(kept);
}

export function toggleFavoriteShopId(id: number): number[] {
  toggleFavoriteShop(id);
  return loadFavoriteShopIds();
}
