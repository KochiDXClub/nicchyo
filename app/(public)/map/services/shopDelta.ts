import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import type { Database } from "@/types/database.types";
import { MAP_PRODUCT_COLUMNS, MAP_VENDOR_COLUMNS, type ProductRow, type VendorRow } from "./shopDb";

/**
 * 地図の店舗データ（vendors / products）の差分更新。
 *
 * 店舗の基本データは大きいので、サーバーのメモリに持ち、更新のたびに「前回から変わった行」だけを
 * 取って重ねる。たまに（一日に一度）全件を読み直して、取りこぼしがあっても自然に直るようにする。
 *
 * 取りこぼしを防ぐための決まり:
 *  - 基準は DB の時計（updated_at。DB のトリガーが必ず更新する）。基準より少し前から取り直し、
 *    長いトランザクションの途中で更新された行も拾う。行は id で上書きするので、重なっても害はない。
 *  - 削除は updated_at では見えない。products は論理削除（deleted_at）にして、
 *    削除された id だけを返す DB 関数（list_deleted_product_ids）で知る。
 *  - 店舗が掲載の許可を取り下げた／削除されたときは、来訪者（anon）からは行ごと見えなくなるため、
 *    変更として届かない。見える店舗の数が合わなくなったら id の一覧で突き合わせ、消えた店舗と
 *    その商品を捨てる。数が合っていても、一定間隔で一覧の突き合わせをする。
 *  - 掲載の許可を新しく受けた店舗は、商品の updated_at が古いままなので、新しく見えた店舗の商品は
 *    全件を取り直す。
 */

/** 基準より少し前から取り直す幅。トランザクションの遅れ・時計のずれを吸収する */
export const CURSOR_MARGIN_MS = 5 * 60 * 1000;
/** 店舗の id 一覧で突き合わせる間隔（数が合っていても、入れ替わりを見逃さないため） */
export const ID_CHECK_INTERVAL_MS = 5 * 60 * 1000;

const EPOCH_ISO = "1970-01-01T00:00:00.000Z";
/** .in() に渡す id の数（URL が長くなりすぎないように分ける） */
const ID_CHUNK_SIZE = 100;

export type DeltaStore = {
  vendors: Map<string, VendorRow>;
  products: Map<string, ProductRow>;
  /** 取り込んだ行の updated_at の最大値（ミリ秒）。無ければ null（＝次は全件を取る） */
  vendorCursorMs: number | null;
  productCursorMs: number | null;
  /** 最後に差分を取り始めた時刻（アプリの時計）。削除の一覧の基準に使う */
  syncStartedAtMs: number;
  /** 最後に店舗の id 一覧で突き合わせた時刻 */
  idCheckedAtMs: number;
};

/** DB へ問い合わせる部分。差分の組み立て（merge）を DB なしで試せるように分けている */
export type DeltaSource = {
  allVendors(): Promise<VendorRow[]>;
  allProducts(): Promise<ProductRow[]>;
  /** updated_at が sinceIso より新しい vendors（来訪者に見える行だけ） */
  changedVendors(sinceIso: string): Promise<VendorRow[]>;
  changedProducts(sinceIso: string): Promise<ProductRow[]>;
  /** 論理削除された商品の id（updated_at が sinceIso より新しいもの） */
  deletedProductIds(sinceIso: string): Promise<string[]>;
  /** 来訪者に見える vendors の数と id 一覧 */
  visibleVendorCount(): Promise<number>;
  visibleVendorIds(): Promise<string[]>;
  vendorsByIds(ids: string[]): Promise<VendorRow[]>;
  productsByVendorIds(vendorIds: string[]): Promise<ProductRow[]>;
};

function toMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function maxCursor(current: number | null, rows: { updated_at?: string | null }[]): number | null {
  let max = current;
  for (const row of rows) {
    const ms = toMs(row.updated_at);
    if (ms !== null && (max === null || ms > max)) max = ms;
  }
  return max;
}

function sinceIso(cursorMs: number | null): string {
  return cursorMs === null ? EPOCH_ISO : new Date(cursorMs - CURSOR_MARGIN_MS).toISOString();
}

function chunk<T>(items: T[]): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += ID_CHUNK_SIZE) chunks.push(items.slice(i, i + ID_CHUNK_SIZE));
  return chunks;
}

/** 全件を読み直す（起動直後と、一日に一度） */
export async function loadFullStore(source: DeltaSource, nowMs: number): Promise<DeltaStore> {
  const [vendors, products] = await Promise.all([source.allVendors(), source.allProducts()]);
  // 来訪者に見えない店舗の商品は、RLS で元から返らない。念のため店舗が無い商品は持たない
  const vendorMap = new Map(vendors.map((row) => [row.id, row]));
  const productMap = new Map<string, ProductRow>();
  for (const row of products) {
    if (row.id && row.vendor_id && vendorMap.has(row.vendor_id)) productMap.set(row.id, row);
  }
  return {
    vendors: vendorMap,
    products: productMap,
    vendorCursorMs: maxCursor(null, vendors),
    productCursorMs: maxCursor(null, products),
    syncStartedAtMs: nowMs,
    idCheckedAtMs: nowMs,
  };
}

/**
 * 前回から変わった行を重ねた、新しい store を返す（引数の store は書き換えない。失敗したときに
 * 中途半端な状態を残さないため）。途中で失敗したら例外にする。
 */
export async function syncStore(
  source: DeltaSource,
  store: DeltaStore,
  nowMs: number,
  { forceIdCheck = false }: { forceIdCheck?: boolean } = {}
): Promise<DeltaStore> {
  const vendorSince = sinceIso(store.vendorCursorMs);
  const productSince = sinceIso(store.productCursorMs);
  const deletedSince = new Date(store.syncStartedAtMs - CURSOR_MARGIN_MS).toISOString();

  const [changedVendors, changedProducts, deletedIds, visibleCount] = await Promise.all([
    source.changedVendors(vendorSince),
    source.changedProducts(productSince),
    source.deletedProductIds(deletedSince),
    source.visibleVendorCount(),
  ]);

  const vendors = new Map(store.vendors);
  const products = new Map(store.products);
  // 商品を全件取り直す店舗（新しく見えるようになった店舗）
  const refetchProductsFor = new Set<string>();

  let vendorCursorMs = maxCursor(store.vendorCursorMs, changedVendors);
  let productCursorMs = maxCursor(store.productCursorMs, changedProducts);

  for (const row of changedVendors) {
    if (!vendors.has(row.id)) refetchProductsFor.add(row.id);
    vendors.set(row.id, row);
  }
  for (const id of deletedIds) products.delete(id);

  // 来訪者に見える店舗の数が合わない（掲載の取り下げ・店舗の削除・取りこぼし）か、
  // 前回の突き合わせから時間が経っていたら、id の一覧で突き合わせる
  let idCheckedAtMs = store.idCheckedAtMs;
  if (forceIdCheck || visibleCount !== vendors.size || nowMs - store.idCheckedAtMs >= ID_CHECK_INTERVAL_MS) {
    const visibleIds = new Set(await source.visibleVendorIds());
    for (const id of Array.from(vendors.keys())) {
      if (!visibleIds.has(id)) vendors.delete(id);
    }
    const missing = Array.from(visibleIds).filter((id) => !vendors.has(id));
    if (missing.length > 0) {
      const fetched: VendorRow[] = [];
      for (const ids of chunk(missing)) fetched.push(...(await source.vendorsByIds(ids)));
      for (const row of fetched) {
        vendors.set(row.id, row);
        refetchProductsFor.add(row.id);
      }
      vendorCursorMs = maxCursor(vendorCursorMs, fetched);
    }
    idCheckedAtMs = nowMs;
  }

  // 新しく見える店舗の商品は全件を取り直す（許可を受けた店舗の商品は updated_at が古いまま）
  const refetchIds = Array.from(refetchProductsFor).filter((id) => vendors.has(id));
  if (refetchIds.length > 0) {
    const fetched: ProductRow[] = [];
    for (const ids of chunk(refetchIds)) fetched.push(...(await source.productsByVendorIds(ids)));
    for (const [id, row] of products) {
      if (row.vendor_id && refetchProductsFor.has(row.vendor_id)) products.delete(id);
    }
    for (const row of fetched) if (row.id) products.set(row.id, row);
    productCursorMs = maxCursor(productCursorMs, fetched);
  }

  for (const row of changedProducts) if (row.id) products.set(row.id, row);

  // 見えなくなった店舗の商品を捨てる
  for (const [id, row] of products) {
    if (!row.vendor_id || !vendors.has(row.vendor_id)) products.delete(id);
  }

  return {
    vendors,
    products,
    vendorCursorMs,
    productCursorMs,
    syncStartedAtMs: nowMs,
    idCheckedAtMs,
  };
}

/** 全件取得と同じ並び（id の昇順）で返す。buildVendorShops の並びがここに依存する */
export function storeToRows(store: DeltaStore): { vendors: VendorRow[]; products: ProductRow[] } {
  const byId = (a: { id?: string }, b: { id?: string }) => (a.id ?? "").localeCompare(b.id ?? "");
  return {
    vendors: Array.from(store.vendors.values()).sort(byId),
    products: Array.from(store.products.values()).sort(byId),
  };
}

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function readAll<T>(label: string, fetchPage: (from: number, to: number) => Page<T>): Promise<T[]> {
  const { data, error } = await fetchAllRows<T>(fetchPage, { label });
  if (error) throw new Error(`${label} の取得に失敗しました: ${error.message}`);
  return data;
}

/** Supabase から取る実装。必ず Cookie を持たない anon クライアントを渡す（共有キャッシュに入るため） */
export function createSupabaseDeltaSource(supabase: SupabaseClient<Database>): DeltaSource {
  const vendorQuery = () => supabase.from("vendors").select(MAP_VENDOR_COLUMNS);
  const productQuery = () => supabase.from("products").select(MAP_PRODUCT_COLUMNS).is("deleted_at", null);
  const asPage = <T>(query: unknown) => query as Page<T>;

  return {
    allVendors: () =>
      readAll<VendorRow>("vendors", (from, to) =>
        asPage(vendorQuery().order("id", { ascending: true }).range(from, to))
      ),
    allProducts: () =>
      readAll<ProductRow>("products", (from, to) =>
        asPage(productQuery().order("id", { ascending: true }).range(from, to))
      ),
    changedVendors: (since) =>
      readAll<VendorRow>("vendors(差分)", (from, to) =>
        asPage(
          vendorQuery()
            .gt("updated_at", since)
            .order("updated_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to)
        )
      ),
    changedProducts: (since) =>
      readAll<ProductRow>("products(差分)", (from, to) =>
        asPage(
          productQuery()
            .gt("updated_at", since)
            .order("updated_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to)
        )
      ),
    deletedProductIds: async (since) => {
      const { data, error } = await supabase.rpc("list_deleted_product_ids", { p_since: since });
      if (error) throw new Error(`削除された商品の取得に失敗しました: ${error.message}`);
      return (data ?? []).map((row) => row.id);
    },
    visibleVendorCount: async () => {
      const { count, error } = await supabase.from("vendors").select("id", { count: "exact", head: true });
      if (error || count === null) {
        throw new Error(`店舗数の取得に失敗しました: ${error?.message ?? "count が返りません"}`);
      }
      return count;
    },
    visibleVendorIds: async () => {
      const rows = await readAll<{ id: string }>("vendors(id)", (from, to) =>
        asPage(supabase.from("vendors").select("id").order("id", { ascending: true }).range(from, to))
      );
      return rows.map((row) => row.id);
    },
    vendorsByIds: (ids) =>
      readAll<VendorRow>("vendors(id指定)", (from, to) =>
        asPage(vendorQuery().in("id", ids).order("id", { ascending: true }).range(from, to))
      ),
    productsByVendorIds: (vendorIds) =>
      readAll<ProductRow>("products(店舗指定)", (from, to) =>
        asPage(productQuery().in("vendor_id", vendorIds).order("id", { ascending: true }).range(from, to))
      ),
  };
}
