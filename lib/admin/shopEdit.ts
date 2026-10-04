/**
 * 運営が店舗の情報を代理で編集するときの入力の検証（PATCH /api/admin/shops/[id]）。
 *
 * 出店者本人の編集（app/vendor/_services/storeService.ts）は、ブラウザから RLS 越しに書く。
 * 運営の代理編集は、現地で出店者から聞いた内容を入れるので、サーバー側（service_role）で
 * 受け取った値を検証してから書く。送られてきた項目だけを更新する（未指定の項目は触らない）。
 */
import { isEndAfterStart, parseTime } from "@/lib/vendor/businessHours";
import { PAYMENT_OPTIONS, RAIN_OPTIONS } from "@/lib/vendor/storeOptions";

export const LISTING_STATUSES = ["pending", "allowed", "declined"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  pending: "未取得",
  allowed: "許可済み",
  declined: "断られた",
};

const MAX_NAME = 100;
const MAX_TEXT = 500;
const MAX_NOTE = 1000;
const MAX_PRODUCTS = 50;
const MAX_PRODUCT_NAME = 60;
const MAX_PRICE = 10_000_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const PAYMENT_KEYS = new Set<string>(PAYMENT_OPTIONS.map((o) => o.key));
// "rain_policy" の保存値は RAIN_OPTIONS の key（outdoor/cancel/undecided）と、旧来の tent
const RAIN_KEYS = new Set<string>([...RAIN_OPTIONS.map((o) => o.key), "tent"]);

/** vendors に書く列。型は types/database.types.ts の vendors.Update のうち、運営が代理編集する列 */
type ShopEditFields = {
  shop_name: string;
  category_id: string | null;
  style: string | null;
  strength: string | null;
  main_products: string[];
  main_product_prices: Record<string, number | null>;
  payment_methods: string[];
  rain_policy: string;
  sns_instagram: string | null;
  sns_x: string | null;
  sns_hp: string | null;
  business_hours_start: string | null;
  business_hours_end: string | null;
  shop_image_url: string | null;
  listing_status: ListingStatus;
  photo_use_allowed: boolean;
  listing_consented_on: string | null;
  listing_consent_note: string | null;
};

export type ShopEditUpdate = Partial<ShopEditFields>;

type Nullable<T> = { [K in keyof T]: T[K] | null };

/** GET /api/admin/shops/[id] が返す店舗 1 件（閲覧・代理編集の画面で共有する）。列は ShopEditFields から導く */
export type AdminShopDetail = Pick<ShopEditFields, "shop_name" | "listing_status" | "photo_use_allowed"> &
  Nullable<Omit<ShopEditFields, "shop_name" | "listing_status" | "photo_use_allowed">> & {
    id: string;
    category_name: string | null;
    owner_name: string | null;
    store_number: number | null;
    updated_at: string | null;
  };

export type ShopEditParsed = {
  vendor: ShopEditUpdate;
  /** vendor_owner_profiles に書く。undefined なら触らない */
  ownerName?: string | null;
};

export type ShopEditResult =
  | { ok: true; value: ShopEditParsed }
  | { ok: false; error: string };

const fail = (error: string): ShopEditResult => ({ ok: false, error });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 空文字は null（未入力）にそろえる。文字列でなければ undefined（不正） */
function textOrNull(value: unknown, max: number): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length > max) return undefined;
  return trimmed === "" ? null : trimmed;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** vendor-images バケットの公開 URL か（https で、Supabase Storage の公開パス） */
export function isVendorImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.pathname.startsWith("/storage/v1/object/public/vendor-images/");
  } catch {
    return false;
  }
}

export function parseShopEdit(body: unknown): ShopEditResult {
  if (!isRecord(body)) return fail("リクエストの形が正しくありません");

  const vendor: ShopEditUpdate = {};
  let ownerName: string | null | undefined;

  if ("shop_name" in body) {
    const name = textOrNull(body.shop_name, MAX_NAME);
    if (!name) return fail("店名は1〜100文字で入力してください");
    vendor.shop_name = name;
  }

  if ("category_id" in body) {
    const id = body.category_id;
    if (id !== null && !(typeof id === "string" && UUID_RE.test(id))) return fail("カテゴリが正しくありません");
    vendor.category_id = id as string | null;
  }

  for (const key of ["style", "strength"] as const) {
    if (key in body) {
      const text = textOrNull(body[key], MAX_TEXT);
      if (text === undefined) return fail(`${key} は${MAX_TEXT}文字以内の文字列で入力してください`);
      vendor[key] = text;
    }
  }

  if ("main_products" in body) {
    const products = body.main_products;
    if (!Array.isArray(products) || products.length > MAX_PRODUCTS) {
      return fail(`商品は${MAX_PRODUCTS}件までです`);
    }
    const names: string[] = [];
    for (const item of products) {
      const name = typeof item === "string" ? item.trim() : "";
      if (name === "" || name.length > MAX_PRODUCT_NAME) return fail(`商品名は1〜${MAX_PRODUCT_NAME}文字で入力してください`);
      if (!names.includes(name)) names.push(name);
    }
    vendor.main_products = names;
  }

  if ("main_product_prices" in body) {
    const prices = body.main_product_prices;
    if (!isRecord(prices)) return fail("価格の形が正しくありません");
    const cleaned: Record<string, number | null> = {};
    for (const [name, price] of Object.entries(prices)) {
      if (price === null) {
        cleaned[name] = null;
      } else if (typeof price === "number" && Number.isInteger(price) && price >= 0 && price <= MAX_PRICE) {
        cleaned[name] = price;
      } else {
        return fail(`「${name}」の価格は0以上の整数で入力してください`);
      }
    }
    vendor.main_product_prices = cleaned;
  }

  if ("payment_methods" in body) {
    const methods = body.payment_methods;
    if (!Array.isArray(methods) || !methods.every((m) => typeof m === "string" && PAYMENT_KEYS.has(m))) {
      return fail("決済方法が正しくありません");
    }
    vendor.payment_methods = Array.from(new Set(methods as string[]));
  }

  if ("rain_policy" in body) {
    if (typeof body.rain_policy !== "string" || !RAIN_KEYS.has(body.rain_policy)) {
      return fail("雨天時の方針が正しくありません");
    }
    vendor.rain_policy = body.rain_policy;
  }

  for (const key of ["sns_instagram", "sns_x", "sns_hp"] as const) {
    if (key in body) {
      const text = textOrNull(body[key], MAX_TEXT);
      if (text === undefined) return fail(`${key} は${MAX_TEXT}文字以内で入力してください`);
      // URL で保存するのは sns_hp だけ（Instagram / X は ID でもよい。既存の入力に合わせる）
      if (key === "sns_hp" && text !== null && !isHttpUrl(text)) return fail("ホームページは http(s):// から始まる URL にしてください");
      vendor[key] = text;
    }
  }

  const hasStart = "business_hours_start" in body;
  const hasEnd = "business_hours_end" in body;
  if (hasStart || hasEnd) {
    const start = hasStart ? textOrNull(body.business_hours_start, 5) : undefined;
    const end = hasEnd ? textOrNull(body.business_hours_end, 5) : undefined;
    if (start === undefined && hasStart) return fail("営業時間（開始）が正しくありません");
    if (end === undefined && hasEnd) return fail("営業時間（終了）が正しくありません");
    if (start && !parseTime(start)) return fail("営業時間（開始）は5:00〜24:00の10分刻みで選んでください");
    if (end && !parseTime(end)) return fail("営業時間（終了）は5:00〜24:00の10分刻みで選んでください");
    // 両方そろっているときだけ前後を確かめる（片方だけの更新では、保存済みの相手側を知らない）
    if (start && end && !isEndAfterStart(start, end)) return fail("終了時刻は開始時刻より後にしてください");
    if (hasStart) vendor.business_hours_start = start ?? null;
    if (hasEnd) vendor.business_hours_end = end ?? null;
  }

  if ("shop_image_url" in body) {
    const url = textOrNull(body.shop_image_url, 2000);
    // 来訪者の画面が読み込む URL なので、運営のアップロード先（vendor-images の公開 URL）だけを許す。
    // 外部のホストを指すと、閲覧者の通信が外へ出る
    if (url === undefined || (url !== null && !isVendorImageUrl(url))) return fail("写真の URL が正しくありません");
    vendor.shop_image_url = url;
  }

  if ("listing_status" in body) {
    if (!LISTING_STATUSES.includes(body.listing_status as ListingStatus)) return fail("掲載許可の値が正しくありません");
    vendor.listing_status = body.listing_status as ListingStatus;
  }

  if ("photo_use_allowed" in body) {
    if (typeof body.photo_use_allowed !== "boolean") return fail("写真の使用許可の値が正しくありません");
    vendor.photo_use_allowed = body.photo_use_allowed;
  }

  if ("listing_consented_on" in body) {
    const date = body.listing_consented_on;
    if (date !== null && !(typeof date === "string" && DATE_RE.test(date) && !Number.isNaN(Date.parse(date)))) {
      return fail("許可をもらった日が正しくありません");
    }
    vendor.listing_consented_on = date as string | null;
  }

  if ("listing_consent_note" in body) {
    const note = textOrNull(body.listing_consent_note, MAX_NOTE);
    if (note === undefined) return fail(`許可のメモは${MAX_NOTE}文字以内で入力してください`);
    vendor.listing_consent_note = note;
  }

  if ("owner_name" in body) {
    const name = textOrNull(body.owner_name, MAX_NAME);
    if (name === undefined) return fail("店主名が正しくありません");
    ownerName = name;
  }

  if (Object.keys(vendor).length === 0 && ownerName === undefined) return fail("更新する項目がありません");

  return { ok: true, value: { vendor, ownerName } };
}

/** GET /api/admin/shops/[id] が返す店舗 1 件（閲覧・代理編集の画面で共有する） */
export type AdminShopDetail = {
  id: string;
  shop_name: string;
  category_id: string | null;
  category_name: string | null;
  style: string | null;
  strength: string | null;
  main_products: string[] | null;
  main_product_prices: Record<string, number | null> | null;
  payment_methods: string[] | null;
  rain_policy: string | null;
  sns_instagram: string | null;
  sns_x: string | null;
  sns_hp: string | null;
  business_hours_start: string | null;
  business_hours_end: string | null;
  shop_image_url: string | null;
  listing_status: ListingStatus;
  photo_use_allowed: boolean;
  listing_consented_on: string | null;
  listing_consent_note: string | null;
  owner_name: string | null;
  store_number: number | null;
  updated_at: string | null;
};
