import { parseCsvWithLines } from "@/lib/csv/parseCsv";
import { MAX_SHOP_ID, MIN_SHOP_ID } from "@/lib/shops/route";
import { pointAlongRoad, roadLengthMeters, roadSlotLatLng, type RoadSide } from "@/lib/map/roadSlotPosition";
import type { ChomeRange } from "@/lib/map/chomeBoundaries";
import { normalizeChomeId } from "@/lib/map/chomes";
import { CHOME_ORDER, CHOME_WEST_TO_EAST, NEW_VENDOR_ID_PREFIX, VENDOR_FIELD_LIMITS } from "../../map/types/editableShop";
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
  const { rows: table, lines: tableLines } = parseCsvWithLines(text);
  const errors: ImportIssue[] = [];
  if (table.length === 0) return { rows: [], errors: [{ line: null, message: "CSV が空です。" }] };

  const header = table[0].map((cell) => cell.trim());
  const missing = REQUIRED_HEADERS.filter((name) => !header.includes(name));
  if (missing.length > 0) {
    return { rows: [], errors: [{ line: 1, message: `見出しに「${missing.join("」「")}」がありません。文字化けしているときは、CSV UTF-8（コンマ区切り）で保存し直してください。` }] };
  }
  const col = (name: string) => header.indexOf(name);

  const rows: StoreCsvRow[] = [];
  const seen = new Map<string, number>();
  table.slice(1).forEach((cells, index) => {
    // 値がすべて空の行やクォート内の改行があっても、ファイルの実際の行番号を出す
    const line = tableLines[index + 1];
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
  /** 取り込む行の数 */
  rowCount: number;
  /** 置く道がまだ無いため飛ばした行の数（大橋通りの道を作る前の7丁目など） */
  skippedRowCount: number;
  createdSlotCount: number;
  updatedSlotCount: number;
  deletedSlotCount: number;
  createdVendorCount: number;
  updatedVendorCount: number;
  /** 同じ店名の登録済みの出店者があったので、新しく作らずに区画へ割り当てた件数 */
  reusedVendorCount: number;
  /** 削除する区画にいた出店者のうち、取り込み後にどの区画にもいなくなるので削除する件数 */
  deletedVendorCount: number;
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
 * - 置く道は自動で決める（defaultImportRoads）。大橋通りの道がまだ無いあいだは、
 *   大橋通りの行のうち新しく作る区画だけを飛ばし、ほかの行は取り込む。道を作ってから
 *   同じ CSV を取り込み直せば、飛ばした行の区画だけが追加される
 * - 本番号＋枝番が同じ区画があれば、位置はそのままで出店者の情報を更新する（取り込み直しても重複しない）
 * - 無ければ道の上に区画を作る。北・南は追手筋（northSouth）の住所録の上側・下側に、
 *   丁目の順（六→七→五→…→一丁目が西から東）・番号の大きい順（住所録の番号は東の一丁目から西の六丁目へ増える）で等間隔に並べる。大橋通りは ohashi の道の東側に、番号の小さい方を北にして等間隔に並べる
 * - replace が true なら、CSV に無い区画を削除する（出店者の情報は消さず、割り当てだけ外れる）
 * - replace と deleteVendors がどちらも true なら、削除する区画にいた出店者のうち、取り込み後に
 *   どの区画にもいなくなるものを出店者ごと削除する（商品・投稿もまとめて消える）。
 *   削除する区画にいなかった出店者（アカウントだけ作った出店者など）は、どの区画にもいなくても残す
 */
export function planStoreImport(input: {
  rows: StoreCsvRow[];
  parseErrors: ImportIssue[];
  shops: EditableShop[];
  vendors: EditableVendor[];
  categories: VendorCategory[];
  roads: StoreImportRoads;
  /** 丁目ごとの区間（境目を道に投影した範囲）。あれば、北・南の区画を丁目の区間の中に置く */
  chomeRanges?: ChomeRange[];
  replace: boolean;
  /** replace が true のときだけ効く。削除する区画の出店者を、出店者ごと削除する */
  deleteVendors?: boolean;
  now?: number;
}): StoreImportPlan {
  const { shops, vendors, categories, roads, replace } = input;
  const deleteVendors = replace && input.deleteVendors === true;
  const errors: ImportIssue[] = [...input.parseErrors];
  const warnings: ImportIssue[] = [];

  const categoryIdByName = new Map(categories.map((c) => [c.name.trim(), c.id]));
  const shopByNumber = new Map(
    shops.filter((s) => s.officialNumber != null).map((s) => [`${s.officialNumber}-${s.branchNumber ?? 0}`, s])
  );
  const hasRoad = (road: EditableRoad | null) => !!road && road.points.length >= 2;

  // 大橋通りの道がまだ無ければ、大橋通りの行のうち新しく作る区画は飛ばす
  const skipped = input.rows.filter(
    (row) =>
      row.side === "ohashi" &&
      !hasRoad(roads.ohashi) &&
      !shopByNumber.has(`${row.officialNumber}-${row.branchNumber ?? 0}`)
  );
  for (const row of skipped) {
    warnings.push({
      line: row.line,
      message: "大橋通りの道がまだ無いため、この行は取り込みません。「道を描く」で「大橋通り」という名前の道を作ってから、同じ CSV を取り込み直してください",
    });
  }
  const rows = input.rows.filter((row) => !skipped.includes(row));
  const empty = {
    rowCount: rows.length,
    skippedRowCount: skipped.length,
    createdSlotCount: 0,
    updatedSlotCount: 0,
    deletedSlotCount: 0,
    createdVendorCount: 0,
    updatedVendorCount: 0,
    reusedVendorCount: 0,
    deletedVendorCount: 0,
  };

  if (input.rows.length === 0 && errors.length === 0) errors.push({ line: null, message: "取り込む行がありません。" });

  // 道の確認
  for (const row of rows) {
    const matched = shopByNumber.get(`${row.officialNumber}-${row.branchNumber ?? 0}`);
    if (!matched && row.side !== "ohashi" && !hasRoad(roads.northSouth)) {
      errors.push({
        line: row.line,
        message: "「北」「南」の区画を置く道（追手筋）がありません。「道を描く」で「追手筋」という名前の道を作ってください",
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
    // 六丁目が西（高知城前）、一丁目が東（はりまや橋側）。道が東から西へ描かれていれば、始点からの距離を逆にする
    const first = road.points[0];
    const last = road.points[road.points.length - 1];
    const westToEast = first.lng <= last.lng;
    const rangeOfChome = (chome: string) => {
      const id = normalizeChomeId(chome);
      return id == null ? undefined : (input.chomeRanges ?? []).find((r) => r.roadId === road.id && r.chomeId === id);
    };
    for (const side of ["north", "south"] as const) {
      const list = newRows
        .filter((row) => row.side === side)
        .sort((a, b) => CHOME_WEST_TO_EAST.indexOf(a.chome as never) - CHOME_WEST_TO_EAST.indexOf(b.chome as never) || byNumber(b, a));
      const placedSide: RoadSide = side === "north" ? northSide : northSide === "left" ? "right" : "left";
      // 丁目の区間が分かる丁目は、その区間の中に西から等間隔で置く。分からない丁目の区画は、残りをまとめて道全体に並べる
      const inRange = list.filter((row) => rangeOfChome(row.chome));
      const rest = list.filter((row) => !rangeOfChome(row.chome));
      for (const chome of new Set(inRange.map((row) => row.chome))) {
        const range = rangeOfChome(chome)!;
        const rows = inRange.filter((row) => row.chome === chome);
        rows.forEach((row, i) => {
          const t = (i + 0.5) / rows.length; // 西端からの割合
          const d = westToEast ? range.startM + t * (range.endM - range.startM) : range.endM - t * (range.endM - range.startM);
          placement.set(row, { road, distanceM: d, side: placedSide });
        });
      }
      rest.forEach((row, i) => {
        const d = ((i + 0.5) * length) / rest.length;
        placement.set(row, { road, distanceM: westToEast ? d : length - d, side: placedSide });
      });
    }
  }
  if (roads.ohashi) {
    const road = roads.ohashi;
    const length = roadLengthMeters(road.points);
    // 7丁目は大橋通りの東側にだけ並ぶ。番号の小さい方が北、大きい方が南
    const list = newRows.filter((row) => row.side === "ohashi").sort(byNumber);
    const mid = pointAlongRoad(road.points, length / 2);
    const eastSide: RoadSide = mid.leftX >= 0 ? "left" : "right";
    const first = road.points[0];
    const last = road.points[road.points.length - 1];
    const startsAtSouth = first.lat <= last.lat;
    list.forEach((row, i) => {
      const d = ((i + 0.5) * length) / list.length;
      placement.set(row, { road, distanceM: startsAtSouth ? length - d : d, side: eastSide });
    });
  }

  // ── 削除する区画と、新しい区画の店番 ──
  const csvKeys = new Set(input.rows.map((row) => `${row.officialNumber}-${row.branchNumber ?? 0}`));
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
  let reusedVendorCount = 0;
  const nextShops = shops.filter((s) => !deletedIds.has(s.locationId));
  // 新しい出店者を作る前に、同じ店名の登録済みの出店者を探して使う。住所録の番号の列は新しいので、
  // 初めての取り込みでは既存の区画が番号で一致せず、何もしないと、アカウント・写真を持つ実在の出店者と
  // 同じ店名の出店者が二重にできてしまう（店名で一意に決まるものだけを使い、迷うときは新しく作る）
  const nameKey = (name: string) => name.normalize("NFKC").replace(/\s+/g, "");
  const assignedVendorIds = new Set(nextShops.flatMap((s) => (s.vendorId ? [s.vendorId] : [])));
  const registeredByName = new Map<string, EditableVendor[]>();
  for (const vendor of vendors) {
    if (vendor.id.startsWith(NEW_VENDOR_ID_PREFIX)) continue;
    const key = nameKey(vendor.name);
    if (key) registeredByName.set(key, [...(registeredByName.get(key) ?? []), vendor]);
  }
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
    } else if (row.name && registeredByName.get(nameKey(row.name))?.length === 1 && !assignedVendorIds.has(registeredByName.get(nameKey(row.name))![0].id)) {
      // 同じ店名の登録済みの出店者が1人だけで、ほかの区画にいなければ、その出店者を割り当てる（情報は上書きしない）
      vendorId = registeredByName.get(nameKey(row.name))![0].id;
      reusedVendorCount += 1;
      warnings.push({ line: row.line, message: `「${row.name}」は登録済みの出店者です。新しく作らず、この区画に割り当てます` });
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
    assignedVendorIds.add(vendorId);
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

  // 削除する区画にいた出店者のうち、取り込み後にどの区画にもいなくなったものを出店者ごと消す。
  // 取り込みで同じ店名として区画に割り当て直した出店者（assignedVendorIds）は残す
  const deletedVendorIds = new Set(
    deleteVendors
      ? deleted.flatMap((s) => (s.vendorId && !s.vendorId.startsWith(NEW_VENDOR_ID_PREFIX) && !assignedVendorIds.has(s.vendorId) ? [s.vendorId] : []))
      : []
  );
  const vendorsAfterImport = deletedVendorIds.size > 0 ? nextVendors.filter((v) => !deletedVendorIds.has(v.id)) : nextVendors;

  return {
    rowCount: rows.length,
    skippedRowCount: skipped.length,
    createdSlotCount: newRows.length,
    updatedSlotCount: rows.length - newRows.length,
    deletedSlotCount: deleted.length,
    createdVendorCount,
    updatedVendorCount,
    reusedVendorCount,
    deletedVendorCount: deletedVendorIds.size,
    errors,
    warnings,
    next: { shops: nextShops, vendors: vendorsAfterImport },
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

