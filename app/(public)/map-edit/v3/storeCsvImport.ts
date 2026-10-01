import { parseCsv } from "@/lib/csv/parseCsv";
import { MAX_SHOP_ID, MIN_SHOP_ID } from "@/lib/shops/route";
import { pointAlongRoad, roadLengthMeters, roadSlotLatLng, type RoadSide } from "@/lib/map/roadSlotPosition";
import { CHOME_ORDER, NEW_VENDOR_ID_PREFIX, VENDOR_FIELD_LIMITS } from "../../map/types/editableShop";
import type { EditableRoad, EditableShop, EditableVendor, VendorCategory } from "./types";

/**
 * 出店者の住所録 CSV（stores_import_template.csv）の取り込み。
 *
 * 1行が1区画・1出店者。区画は「本番号＋枝番」で探し、あれば出店者の情報を更新し、
 * 無ければ道の上に新しく作る。取り込みの結果はマップ編集の1件の操作になり、
 * 「変更を保存」で保存する（保存の検証・トランザクション・スナップショットはふだんと同じ）。
 */

/** テンプレートの列（この順で書き出す）。店名・枝番・品目・ジャンルは空でもよい */
export const STORE_CSV_HEADERS = ["本番号", "枝番", "丁目", "側", "店名", "品目", "ジャンル"] as const;
const REQUIRED_HEADERS = ["本番号", "丁目", "側"] as const;

/** 側の値。北・南は住所録の地図で道の上側・下側。大橋通りは7丁目（追手筋と交差する大橋通り沿い） */
export type StoreSide = "north" | "south" | "ohashi";
export const STORE_SIDE_LABEL: Record<StoreSide, string> = { north: "北", south: "南", ohashi: "大橋通り" };

export type StoreCsvRow = {
  /** CSV の行番号（見出しが1行目） */
  line: number;
  officialNumber: number;
  branchNumber: number | null;
  chome: string;
  side: StoreSide;
  name: string;
  products: string[];
  categoryName: string;
};

export type ImportIssue = { line: number | null; message: string };

const toHalfWidth = (value: string) =>
  value.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).trim();

const KANJI_DIGITS = ["一", "二", "三", "四", "五", "六", "七"];

/** 「一丁目」「1丁目」「１」「1」などを CHOME_ORDER の値にする */
export function normalizeChome(value: string): string | null {
  const v = toHalfWidth(value).replace(/\s/g, "");
  if ((CHOME_ORDER as readonly string[]).includes(v)) return v;
  const m = v.match(/^([1-7一二三四五六七])(丁目)?$/);
  if (!m) return null;
  const index = /\d/.test(m[1]) ? Number(m[1]) - 1 : KANJI_DIGITS.indexOf(m[1]);
  return CHOME_ORDER[index] ?? null;
}

export function normalizeSide(value: string): StoreSide | null {
  const v = value.replace(/\s/g, "");
  if (v === "北" || v === "北側") return "north";
  if (v === "南" || v === "南側") return "south";
  if (v === "大橋通り" || v === "大橋通") return "ohashi";
  return null;
}

function parsePositiveInt(value: string): number | null {
  const v = toHalfWidth(value);
  return /^\d+$/.test(v) && Number(v) > 0 ? Number(v) : null;
}

/** 品目（「野菜、果物」）を主な商品の一覧にする */
function splitProducts(value: string): string[] {
  return value
    .split(/[,、，・\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, VENDOR_FIELD_LIMITS.mainProductsMaxCount)
    .map((item) => item.slice(0, VENDOR_FIELD_LIMITS.mainProductMaxLength));
}

/** CSV の文字列を行にする。行ごとの問題（番号が数字でない等）は errors に入れ、その行は取り込まない */
export function parseStoreCsv(text: string): { rows: StoreCsvRow[]; errors: ImportIssue[] } {
  const table = parseCsv(text);
  const errors: ImportIssue[] = [];
  if (table.length === 0) return { rows: [], errors: [{ line: null, message: "CSV が空です。" }] };

  const header = table[0].map((cell) => cell.trim());
  const missing = REQUIRED_HEADERS.filter((name) => !header.includes(name));
  if (missing.length > 0) {
    return { rows: [], errors: [{ line: 1, message: `見出しに「${missing.join("」「")}」がありません。` }] };
  }
  const col = (name: string) => header.indexOf(name);

  const rows: StoreCsvRow[] = [];
  const seen = new Map<string, number>();
  table.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const get = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? "").trim() : "");

    const officialNumber = parsePositiveInt(get("本番号"));
    const branchRaw = get("枝番");
    const branchNumber = branchRaw ? parsePositiveInt(branchRaw) : null;
    const chome = normalizeChome(get("丁目"));
    const side = normalizeSide(get("側"));

    const problems: string[] = [];
    if (officialNumber == null) problems.push(`本番号「${get("本番号")}」が正しくありません`);
    if (branchRaw && branchNumber == null) problems.push(`枝番「${branchRaw}」が正しくありません`);
    if (!chome) problems.push(`丁目「${get("丁目")}」が正しくありません`);
    if (!side) problems.push(`側「${get("側")}」は「北」「南」「大橋通り」のどれかにしてください`);
    if (problems.length > 0) {
      errors.push({ line, message: problems.join("、") });
      return;
    }

    const key = `${officialNumber}-${branchNumber ?? 0}`;
    const label = branchNumber != null ? `${officialNumber}-${branchNumber}` : String(officialNumber);
    if (seen.has(key)) {
      errors.push({ line, message: `番号 ${label} が ${seen.get(key)} 行目と重複しています` });
      return;
    }
    seen.set(key, line);

    rows.push({
      line,
      officialNumber: officialNumber!,
      branchNumber,
      chome: chome!,
      side: side!,
      name: get("店名").slice(0, VENDOR_FIELD_LIMITS.nameMaxLength),
      products: splitProducts(get("品目")),
      categoryName: get("ジャンル"),
    });
  });
  return { rows, errors };
}

export type StoreImportRoads = { northSouth: EditableRoad | null; ohashi: EditableRoad | null };

export type StoreImportPlan = {
  /** 取り込める行の数 */
  rowCount: number;
  createdSlotCount: number;
  updatedSlotCount: number;
  deletedSlotCount: number;
  createdVendorCount: number;
  updatedVendorCount: number;
  /** 取り込めない理由（1つでもあれば適用しない） */
  errors: ImportIssue[];
  /** 取り込めるが確認してほしいこと */
  warnings: ImportIssue[];
  /** 適用後の区画と出店者 */
  next: { shops: EditableShop[]; vendors: EditableVendor[] } | null;
};

const DEFAULT_OFFSET_M = 7.5;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * 取り込みの計画を立てる（状態は変えない）。
 * - 本番号＋枝番が同じ区画があれば、位置はそのままで出店者の情報を更新する（取り込み直しても重複しない）
 * - 無ければ道の上に区画を作る。北・南は追手筋（northSouth）の住所録の上側・下側に、
 *   丁目の順（一丁目が西）・番号の順で等間隔に並べる。大橋通りは ohashi の道に、番号の順で左右交互に並べる
 * - replace が true なら、CSV に無い区画を削除する（出店者の情報は消さず、割り当てだけ外れる）
 */
export function planStoreImport(input: {
  rows: StoreCsvRow[];
  parseErrors: ImportIssue[];
  shops: EditableShop[];
  vendors: EditableVendor[];
  categories: VendorCategory[];
  roads: StoreImportRoads;
  replace: boolean;
  now?: number;
}): StoreImportPlan {
  const { rows, shops, vendors, categories, roads, replace } = input;
  const errors: ImportIssue[] = [...input.parseErrors];
  const warnings: ImportIssue[] = [];
  const empty = { rowCount: rows.length, createdSlotCount: 0, updatedSlotCount: 0, deletedSlotCount: 0, createdVendorCount: 0, updatedVendorCount: 0 };

  if (rows.length === 0 && errors.length === 0) errors.push({ line: null, message: "取り込む行がありません。" });

  const categoryIdByName = new Map(categories.map((c) => [c.name.trim(), c.id]));
  const shopByNumber = new Map(
    shops.filter((s) => s.officialNumber != null).map((s) => [`${s.officialNumber}-${s.branchNumber ?? 0}`, s])
  );

  // 道の確認
  for (const row of rows) {
    const road = row.side === "ohashi" ? roads.ohashi : roads.northSouth;
    const matched = shopByNumber.get(`${row.officialNumber}-${row.branchNumber ?? 0}`);
    if (!matched && (!road || road.points.length < 2)) {
      errors.push({
        line: row.line,
        message:
          row.side === "ohashi"
            ? "大橋通りの道がありません。「道を描く」で大橋通りを作ってから、取り込み画面で選んでください"
            : "北・南の区画を置く道（追手筋）を選んでください",
      });
    }
    if (row.side === "ohashi" && row.chome !== "七丁目") {
      warnings.push({ line: row.line, message: `側が「大橋通り」ですが、丁目が ${row.chome} です` });
    }
    if (row.categoryName && !categoryIdByName.has(row.categoryName)) {
      warnings.push({ line: row.line, message: `ジャンル「${row.categoryName}」が見つからないため、未設定にします` });
    }
  }
  if (errors.length > 0) return { ...empty, errors, warnings, next: null };

  // ── 新しく作る区画の位置 ──
  const newRows = rows.filter((row) => !shopByNumber.has(`${row.officialNumber}-${row.branchNumber ?? 0}`));
  const placement = new Map<StoreCsvRow, { road: EditableRoad; distanceM: number; side: RoadSide }>();
  const byNumber = (a: StoreCsvRow, b: StoreCsvRow) =>
    a.officialNumber - b.officialNumber || (a.branchNumber ?? 0) - (b.branchNumber ?? 0);

  if (roads.northSouth) {
    const road = roads.northSouth;
    const length = roadLengthMeters(road.points);
    // 住所録の「北（上側）」が道の進行方向の左右どちらか
    const mid = pointAlongRoad(road.points, length / 2);
    const northSide: RoadSide = mid.leftY >= 0 ? "left" : "right";
    // 一丁目が西。道が東から西へ描かれていれば、始点からの距離を逆にする
    const first = road.points[0];
    const last = road.points[road.points.length - 1];
    const westToEast = first.lng <= last.lng;
    for (const side of ["north", "south"] as const) {
      const list = newRows
        .filter((row) => row.side === side)
        .sort((a, b) => CHOME_ORDER.indexOf(a.chome as never) - CHOME_ORDER.indexOf(b.chome as never) || byNumber(a, b));
      list.forEach((row, i) => {
        const d = ((i + 0.5) * length) / list.length;
        placement.set(row, {
          road,
          distanceM: westToEast ? d : length - d,
          side: side === "north" ? northSide : northSide === "left" ? "right" : "left",
        });
      });
    }
  }
  if (roads.ohashi) {
    const road = roads.ohashi;
    const length = roadLengthMeters(road.points);
    const list = newRows.filter((row) => row.side === "ohashi").sort(byNumber);
    const pairs = Math.ceil(list.length / 2);
    list.forEach((row, i) => {
      placement.set(row, { road, distanceM: ((Math.floor(i / 2) + 0.5) * length) / pairs, side: i % 2 === 0 ? "left" : "right" });
    });
  }

  // ── 削除する区画と、新しい区画の店番 ──
  const csvKeys = new Set(rows.map((row) => `${row.officialNumber}-${row.branchNumber ?? 0}`));
  const deleted = replace
    ? shops.filter((s) => s.officialNumber == null || !csvKeys.has(`${s.officialNumber}-${s.branchNumber ?? 0}`))
    : [];
  const deletedIds = new Set(deleted.map((s) => s.locationId));
  const used = new Set(shops.filter((s) => !deletedIds.has(s.locationId)).map((s) => s.position));
  const freePositions: number[] = [];
  for (let n = MIN_SHOP_ID; n <= MAX_SHOP_ID && freePositions.length < newRows.length; n += 1) {
    if (!used.has(n)) freePositions.push(n);
  }
  if (freePositions.length < newRows.length) {
    errors.push({ line: null, message: `空いている店番（${MIN_SHOP_ID}〜${MAX_SHOP_ID}）が足りません。「CSVに無い区画を削除」を選ぶか、区画を減らしてください。` });
    return { ...empty, errors, warnings, next: null };
  }

  // ── 適用後の状態 ──
  const now = input.now ?? Date.now();
  const nextVendors = [...vendors];
  const vendorIndex = new Map(nextVendors.map((v, i) => [v.id, i]));
  let createdVendorCount = 0;
  let updatedVendorCount = 0;
  const nextShops = shops.filter((s) => !deletedIds.has(s.locationId));
  const shopIndex = new Map(nextShops.map((s, i) => [s.locationId, i]));
  const offsetCache = new Map<string, number>();
  const offsetFor = (road: EditableRoad, side: RoadSide) => {
    const key = `${road.id}:${side}`;
    if (!offsetCache.has(key)) {
      const onRoad = nextShops.filter((s) => s.roadId === road.id && s.roadOffsetM != null);
      offsetCache.set(
        key,
        median(onRoad.filter((s) => s.roadSide === side).map((s) => s.roadOffsetM!)) ??
          median(onRoad.map((s) => s.roadOffsetM!)) ??
          DEFAULT_OFFSET_M
      );
    }
    return offsetCache.get(key)!;
  };

  let newIndex = 0;
  rows.forEach((row, i) => {
    const label = row.branchNumber != null ? `${row.officialNumber}-${row.branchNumber}` : String(row.officialNumber);
    const categoryId = row.categoryName ? categoryIdByName.get(row.categoryName) ?? null : null;
    const matched = shopByNumber.get(`${row.officialNumber}-${row.branchNumber ?? 0}`);

    // 出店者: 区画に出店者がいれば更新、いなければ新しく登録する
    let vendorId = matched?.vendorId;
    if (vendorId && vendorIndex.has(vendorId)) {
      const current = nextVendors[vendorIndex.get(vendorId)!];
      const updated: EditableVendor = {
        ...current,
        name: row.name || current.name,
        categoryId: row.categoryName ? categoryId : current.categoryId,
        mainProducts: row.products.length > 0 ? row.products : current.mainProducts,
      };
      if (JSON.stringify(updated) !== JSON.stringify(current)) {
        nextVendors[vendorIndex.get(vendorId)!] = updated;
        updatedVendorCount += 1;
      }
    } else {
      vendorId = `${NEW_VENDOR_ID_PREFIX}${now}-${i}`;
      if (!row.name) warnings.push({ line: row.line, message: `店名が空のため「${row.chome} ${STORE_SIDE_LABEL[row.side]} ${label}」にします` });
      nextVendors.push({
        id: vendorId,
        name: row.name || `${row.chome} ${STORE_SIDE_LABEL[row.side]} ${label}`,
        categoryId,
        strength: "",
        mainProducts: row.products,
      });
      vendorIndex.set(vendorId, nextVendors.length - 1);
      createdVendorCount += 1;
    }
    const vendorName = nextVendors[vendorIndex.get(vendorId)!].name;

    if (matched) {
      nextShops[shopIndex.get(matched.locationId)!] = { ...matched, chome: row.chome, vendorId, name: vendorName };
      return;
    }
    const place = placement.get(row)!;
    const position = freePositions[newIndex];
    newIndex += 1;
    const offsetM = offsetFor(place.road, place.side);
    nextShops.push({
      locationId: `new-${now}-${i}`,
      id: position,
      position,
      name: vendorName,
      vendorId,
      chome: row.chome,
      officialNumber: row.officialNumber,
      ...(row.branchNumber != null ? { branchNumber: row.branchNumber } : {}),
      roadId: place.road.id,
      roadDistanceM: place.distanceM,
      roadSide: place.side,
      roadOffsetM: offsetM,
      ...roadSlotLatLng(place.road.points, { distanceM: place.distanceM, side: place.side, offsetM }),
    });
  });

  return {
    rowCount: rows.length,
    createdSlotCount: newRows.length,
    updatedSlotCount: rows.length - newRows.length,
    deletedSlotCount: deleted.length,
    createdVendorCount,
    updatedVendorCount,
    errors,
    warnings,
    next: { shops: nextShops, vendors: nextVendors },
  };
}

/** 道の名前から、取り込み先の道の初期値を選ぶ（追手筋・大橋通り） */
export function defaultImportRoads(roads: EditableRoad[]): StoreImportRoads {
  const usable = roads.filter((road) => road.points.length >= 2);
  const byName = (pattern: RegExp) => usable.find((road) => pattern.test(road.name)) ?? null;
  const longestMarket = [...usable]
    .filter((road) => road.kind === "market")
    .sort((a, b) => roadLengthMeters(b.points) - roadLengthMeters(a.points))[0];
  return { northSouth: byName(/追手筋/) ?? longestMarket ?? null, ohashi: byName(/大橋通/) };
}

