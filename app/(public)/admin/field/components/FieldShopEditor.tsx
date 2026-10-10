"use client";

/**
 * 現地で運営が、出店者から聞いた内容を店舗に登録する画面（スマホ向け）。
 * 出店者のアカウントとは独立して、運営が店舗の中身・掲載許可・写真・位置を代理で入力する。
 *
 * 保存は 3 つに分かれる（通信が不安定でも、済んだ分が残るように）:
 *   - 内容と掲載許可: 下の「保存」ボタン（PATCH /api/admin/shops/[id]）
 *   - 写真: 撮影・選択したらすぐ（POST /api/admin/shops/[id]/image）
 *   - 位置: 「この位置で保存」（PUT /api/admin/shops/[id]/location）
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { showToast } from "@/lib/admin/toast";
import { Surface } from "@/components/ui";
import { MAX_SHOP_ID, MIN_SHOP_ID } from "@/lib/shops/route";
import { createStoreImages, imageErrorMessage } from "@/lib/image/clientCompression";
import { LISTING_STATUS_LABELS, LISTING_STATUSES, type AdminShopDetail, type ListingStatus } from "@/lib/admin/shopEdit";
import { PAYMENT_OPTIONS, RAIN_OPTIONS, TIME_OPTIONS } from "@/lib/vendor/storeOptions";
import { isEndAfterStart } from "@/lib/vendor/businessHours";
import { CHOMES, type ChomeId } from "@/lib/map/chomes";
import { LocationPicker, type FieldLocation, type LatLng } from "./LocationPicker";

type Category = { id: string; name: string };
type ProductRow = { name: string; price: string };

type FormState = {
  shop_name: string;
  category_id: string;
  owner_name: string;
  strength: string;
  style: string;
  products: ProductRow[];
  business_hours_start: string;
  business_hours_end: string;
  payment_methods: string[];
  rain_policy: string;
  sns_instagram: string;
  sns_x: string;
  sns_hp: string;
  listing_status: ListingStatus;
  photo_use_allowed: boolean;
  listing_consented_on: string;
  listing_consent_note: string;
  /** 日曜市の丁目（"" は選んでいない）。区画に保存する */
  chome: string;
};

function toForm(shop: AdminShopDetail): FormState {
  const prices = shop.main_product_prices ?? {};
  return {
    shop_name: shop.shop_name,
    category_id: shop.category_id ?? "",
    owner_name: shop.owner_name ?? "",
    strength: shop.strength ?? "",
    style: shop.style ?? "",
    products: (shop.main_products ?? []).map((name) => ({ name, price: prices[name] != null ? String(prices[name]) : "" })),
    business_hours_start: shop.business_hours_start ?? "",
    business_hours_end: shop.business_hours_end ?? "",
    payment_methods: shop.payment_methods ?? [],
    rain_policy: shop.rain_policy ?? "undecided",
    sns_instagram: shop.sns_instagram ?? "",
    sns_x: shop.sns_x ?? "",
    sns_hp: shop.sns_hp ?? "",
    listing_status: shop.listing_status,
    photo_use_allowed: shop.photo_use_allowed,
    listing_consented_on: shop.listing_consented_on ?? "",
    listing_consent_note: shop.listing_consent_note ?? "",
    chome: shop.chome != null ? String(shop.chome) : "",
  };
}

/** 画面の入力を、PATCH に送る形にする。価格は空欄なら null */
function toPayload(form: FormState) {
  const products = form.products.map((p) => ({ name: p.name.trim(), price: p.price.trim() })).filter((p) => p.name !== "");
  const prices: Record<string, number | null> = {};
  for (const p of products) prices[p.name] = p.price === "" ? null : Number(p.price);
  return {
    shop_name: form.shop_name,
    category_id: form.category_id || null,
    owner_name: form.owner_name,
    strength: form.strength,
    style: form.style,
    main_products: products.map((p) => p.name),
    main_product_prices: prices,
    business_hours_start: form.business_hours_start || null,
    business_hours_end: form.business_hours_end || null,
    payment_methods: form.payment_methods,
    rain_policy: form.rain_policy,
    sns_instagram: form.sns_instagram,
    sns_x: form.sns_x,
    sns_hp: form.sns_hp,
    listing_status: form.listing_status,
    photo_use_allowed: form.photo_use_allowed,
    listing_consented_on: form.listing_consented_on || null,
    listing_consent_note: form.listing_consent_note,
  };
}

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-3 text-base text-nicchyo-ink placeholder:text-nicchyo-ink/40 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200";
const buttonClass =
  "inline-flex min-h-12 items-center justify-center rounded-lg px-4 py-3 text-base font-semibold disabled:opacity-50";

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Surface as="section" padding="sm">
      <h2 className="text-base font-bold text-nicchyo-ink">{title}</h2>
      {hint ? <p className="mt-1 text-[13px] text-nicchyo-ink/55">{hint}</p> : null}
      <div className="mt-3 space-y-3">{children}</div>
    </Surface>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-medium text-nicchyo-ink/70">{label}</span>
      {children}
    </label>
  );
}

async function readError(res: Response, fallback: string): Promise<{ message: string; code?: string }> {
  try {
    const data = (await res.json()) as { error?: string; code?: string };
    return { message: data.error ?? fallback, code: data.code };
  } catch {
    return { message: fallback };
  }
}

export function FieldShopEditor({ shopId }: { shopId: string }) {
  const [shop, setShop] = useState<AdminShopDetail | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [photoBusy, setPhotoBusy] = useState(false);
  const [locations, setLocations] = useState<FieldLocation[]>([]);
  const [storeNumber, setStoreNumber] = useState("");
  const [pin, setPin] = useState<LatLng | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  // 記録した位置の取り方（現在地か、地図で指したか）と、現在地の誤差。地図は直したいときだけ開く
  const [recordedInfo, setRecordedInfo] = useState<{ source: "gps" | "pin" | null; accuracyM: number | null } | null>(null);
  const [showMap, setShowMap] = useState(false);

  const applyLocationResponse = useCallback((data: { locations?: FieldLocation[]; current?: FieldLocation | null }) => {
    setLocations(data.locations ?? []);
    if (data.current) {
      setStoreNumber(data.current.storeNumber != null ? String(data.current.storeNumber) : "");
      setPin({ lat: data.current.lat, lng: data.current.lng });
      if (data.current.recorded) setRecordedInfo({ source: data.current.source ?? null, accuracyM: data.current.accuracyM ?? null });
    }
  }, []);

  /** 位置（店番・ピン・区画一覧）だけ読み直す。フォームと dirty には触らない */
  const refreshLocations = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/location`);
      if (res.ok) applyLocationResponse((await res.json()) as { locations: FieldLocation[]; current: FieldLocation | null });
    } catch {
      // 位置は保存済み。一覧の更新に失敗しても入力は保つ
    }
  }, [shopId, applyLocationResponse]);

  const load = useCallback(async () => {
    try {
      const [shopRes, categoriesRes, locationRes] = await Promise.all([
        fetch(`/api/admin/shops/${shopId}`),
        fetch("/api/admin/categories"),
        fetch(`/api/admin/shops/${shopId}/location`),
      ]);
      if (shopRes.status === 404) throw new Error("店舗が見つかりません");
      if (!shopRes.ok) throw new Error("店舗の取得に失敗しました");
      const { shop: loaded } = (await shopRes.json()) as { shop: AdminShopDetail };
      setShop(loaded);
      setForm(toForm(loaded));
      setDirty(false);
      if (categoriesRes.ok) setCategories(((await categoriesRes.json()) as { categories: Category[] }).categories ?? []);
      if (locationRes.ok) {
        applyLocationResponse((await locationRes.json()) as { locations: FieldLocation[]; current: FieldLocation | null });
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "店舗の取得に失敗しました");
    }
  }, [shopId, applyLocationResponse]);

  useEffect(() => {
    void load();
  }, [load]);

  // 保存していない変更があるまま閉じる・戻るのを防ぐ
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
  }, []);

  const hoursError = useMemo(() => {
    if (!form?.business_hours_start || !form.business_hours_end) return null;
    return isEndAfterStart(form.business_hours_start, form.business_hours_end) ? null : "終了時刻は開始時刻より後にしてください";
  }, [form?.business_hours_start, form?.business_hours_end]);

  const save = async () => {
    if (!form || !shop || hoursError) return;
    if (form.products.some((p) => p.price.trim() !== "" && !/^\d+$/.test(p.price.trim()))) {
      showToast.error("価格は数字だけで入力してください");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/shops/${shopId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // 開いたあとにほかの人が更新していたら、サーバーが断る（上書きしない）
        body: JSON.stringify({
          ...toPayload(form),
          // 丁目は変えたときだけ送る（送ると手で設定した扱いになるため、開いただけの保存では送らない）
          ...(form.chome !== "" && Number(form.chome) !== shop.chome ? { chome: Number(form.chome) as ChomeId } : {}),
          updated_at: shop?.updated_at ?? null,
        }),
      });
      if (!res.ok) throw new Error((await readError(res, "保存できませんでした")).message);
      showToast.success("保存しました");
      await load();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "保存できませんでした");
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const { mainBlob, thumbBlob } = await createStoreImages(file);
      const body = new FormData();
      body.append("main", mainBlob, "main");
      body.append("thumb", thumbBlob, "thumb");
      const res = await fetch(`/api/admin/shops/${shopId}/image`, { method: "POST", body });
      if (!res.ok) throw new Error((await readError(res, "写真を保存できませんでした")).message);
      const { url, updated_at } = (await res.json()) as { url: string; updated_at?: string };
      // 同じ URL に上書きされるので、キャッシュされた古い写真が出ないようにする。
      // 写真の保存で updated_at が進むので反映する（古いままだと、次の「内容を保存」が必ず 409 になる）。
      // フォームには触れない（未保存の入力を消さない）
      setShop((prev) =>
        prev ? { ...prev, shop_image_url: `${url}?v=${Date.now()}`, updated_at: updated_at ?? prev.updated_at } : prev,
      );
      showToast.success("写真を保存しました");
    } catch (e) {
      showToast.error(imageErrorMessage(e, e instanceof Error ? e.message : "写真を保存できませんでした"));
    } finally {
      setPhotoBusy(false);
    }
  };

  const pickStoreNumber = (n: number) => {
    setStoreNumber(String(n));
    // 区画の位置がすでにあれば、ピンをそこへ。なければ今のピンのまま
    const loc = locations.find((l) => l.storeNumber === n);
    if (loc) setPin({ lat: loc.lat, lng: loc.lng });
  };

  /** 位置を記録として保存する。現在地（gps）でも地図で指した位置（pin）でも、同じ保存 */
  const saveLocation = async (position: LatLng, meta: { source: "gps" | "pin"; accuracyM: number | null }) => {
    // 店番は、住所録に無い新しい店舗ではまだ決まっていないので、空でもよい
    const n = storeNumber === "" ? null : Number(storeNumber);
    if (n !== null && !Number.isInteger(n)) {
      showToast.error("店番は数字で入れてください");
      return;
    }
    setLocationBusy(true);
    try {
      // 記録として保存するだけで、地図のデータは変わらない
      const res = await fetch(`/api/admin/shops/${shopId}/location`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeNumber: n, lat: position.lat, lng: position.lng, source: meta.source, accuracyM: meta.accuracyM }),
      });
      if (!res.ok) throw new Error((await readError(res, "位置を保存できませんでした")).message);
      showToast.success("位置を記録しました");
      setPin(position);
      setRecordedInfo(meta);
      // load() はフォームを作り直して未保存の入力を消すので、位置まわりだけ更新する
      setShop((prev) => (prev ? { ...prev, store_number: n, location_recorded: true } : prev));
      await refreshLocations();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "位置を保存できませんでした");
    } finally {
      setLocationBusy(false);
    }
  };

  /** いまいる場所（スマホの現在地）をそのまま記録する。この画面のメインの操作 */
  const recordCurrentPosition = () => {
    if (!navigator.geolocation) {
      showToast.error("この端末では現在地を取得できません。「地図で位置を直す」から指してください");
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsBusy(false);
        const accuracyM = Math.round(pos.coords.accuracy);
        // 誤差が大きいとき（屋内・電波が悪いとき）は、そのまま記録してよいか確かめる
        if (accuracyM > 30 && !window.confirm(`現在地の誤差が約${accuracyM}mあります。この位置で記録しますか？（電波の良いところでもう一度取る方が正確です）`)) return;
        void saveLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }, { source: "gps", accuracyM });
      },
      () => {
        setGpsBusy(false);
        showToast.error("現在地を取得できませんでした。位置情報の許可を確かめるか、「地図で位置を直す」から指してください");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  if (loadError) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        {loadError}
      </p>
    );
  }
  if (!shop || !form) return <p className="text-sm text-nicchyo-ink/55">読み込み中…</p>;

  return (
    <div className="space-y-4 pb-28">
      <Card title="掲載の許可" hint="出店者本人から、掲載してよいか・写真を使ってよいかを聞いて記録します。「許可済み」の店舗だけが来訪者に表示されます。">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="掲載許可">
          {LISTING_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              role="radio"
              aria-checked={form.listing_status === status}
              onClick={() => update("listing_status", status)}
              className={`${buttonClass} border ${
                form.listing_status === status
                  ? status === "allowed"
                    ? "border-green-600 bg-green-600 text-white"
                    : status === "declined"
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-amber-500 bg-amber-500 text-white"
                  : "border-line bg-white text-nicchyo-ink/70"
              }`}
            >
              {LISTING_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
        <label className="flex min-h-12 items-center gap-3 rounded-lg border border-line px-3">
          <input
            type="checkbox"
            checked={form.photo_use_allowed}
            onChange={(e) => update("photo_use_allowed", e.target.checked)}
            className="h-6 w-6"
          />
          <span className="text-base text-nicchyo-ink">写真の掲載も許可をもらった</span>
        </label>
        <Field label="許可をもらった日">
          <input type="date" value={form.listing_consented_on} onChange={(e) => update("listing_consented_on", e.target.value)} className={inputClass} />
        </Field>
        <Field label="許可のメモ（誰から・どう許可をもらったか）">
          <textarea
            value={form.listing_consent_note}
            onChange={(e) => update("listing_consent_note", e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="例: 店主の山田さんから口頭で許可"
            className={inputClass}
          />
        </Field>
      </Card>

      <Card title="店舗の写真" hint={form.photo_use_allowed ? undefined : "写真を使う許可をもらってから、撮影するか端末の写真から選んで登録します（上の「写真の掲載も許可をもらった」にチェック → 保存）。"}>
        {shop.shop_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.shop_image_url} alt={`${shop.shop_name}の写真`} className="max-h-64 w-full rounded-lg border border-line object-contain" />
        ) : (
          <p className="text-sm text-nicchyo-ink/40">まだ写真がありません</p>
        )}
        {/* 撮る（カメラを起動）と、選ぶ（端末の写真から）は別の入口にする */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: "camera", label: "写真を撮る", capture: "environment" as const },
            { key: "library", label: "写真を選ぶ", capture: undefined },
          ].map((entry) => (
            <label
              key={entry.key}
              className={`${buttonClass} cursor-pointer bg-amber-500 text-white ${!shop.photo_use_allowed || photoBusy ? "pointer-events-none opacity-50" : ""}`}
            >
              {photoBusy ? "保存しています…" : entry.label}
              <input
                type="file"
                accept="image/*"
                capture={entry.capture}
                className="sr-only"
                disabled={!shop.photo_use_allowed || photoBusy}
                onChange={(e) => {
                  void uploadPhoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          ))}
        </div>
        {!shop.photo_use_allowed ? <p className="text-[13px] text-amber-700">保存済みの設定で写真の許可がありません</p> : null}
      </Card>

      <Card title="基本の情報">
        <Field label="店名">
          <input value={form.shop_name} onChange={(e) => update("shop_name", e.target.value)} maxLength={100} className={inputClass} />
        </Field>
        <Field label="カテゴリ">
          <select value={form.category_id} onChange={(e) => update("category_id", e.target.value)} className={inputClass}>
            <option value="">未設定</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="日曜市の丁目">
          <select
            value={form.chome}
            onChange={(e) => update("chome", e.target.value)}
            className={inputClass}
          >
            <option value="">未設定</option>
            {CHOMES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-[13px] text-nicchyo-ink/55">
          現場で聞いた丁目として記録します。地図の区画の丁目は変わりません。
        </p>
        <Field label="店主のお名前">
          <input value={form.owner_name} onChange={(e) => update("owner_name", e.target.value)} maxLength={100} className={inputClass} />
        </Field>
        <p className="text-[13px] text-nicchyo-ink/55">店主名は、出店者本人が公開に切り替えるまで来訪者には表示されません。</p>
        <Field label="こだわり・ひとこと">
          <textarea value={form.strength} onChange={(e) => update("strength", e.target.value)} rows={3} maxLength={500} className={inputClass} />
        </Field>
        <Field label="出店スタイル">
          <input value={form.style} onChange={(e) => update("style", e.target.value)} maxLength={500} className={inputClass} />
        </Field>
      </Card>

      <Card title="売っているもの" hint="主な商品と価格（価格は分からなければ空欄でよい）">
        {form.products.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
            <Field label={i === 0 ? "商品名" : ""}>
              <input
                value={p.name}
                onChange={(e) => update("products", form.products.map((row, j) => (j === i ? { ...row, name: e.target.value } : row)))}
                maxLength={60}
                className={inputClass}
              />
            </Field>
            <Field label={i === 0 ? "価格(円)" : ""}>
              <input
                value={p.price}
                inputMode="numeric"
                onChange={(e) => update("products", form.products.map((row, j) => (j === i ? { ...row, price: e.target.value } : row)))}
                className={inputClass}
              />
            </Field>
            <button
              type="button"
              aria-label={`${p.name || "この行"}を削除`}
              onClick={() => update("products", form.products.filter((_, j) => j !== i))}
              className={`${buttonClass} border border-line bg-white text-nicchyo-ink/70`}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={form.products.length >= 50}
          onClick={() => update("products", [...form.products, { name: "", price: "" }])}
          className={`${buttonClass} w-full border border-dashed border-nicchyo-ink/40 bg-white text-nicchyo-ink/70`}
        >
          ＋ 商品を追加
        </button>
      </Card>

      <Card title="出店の情報">
        <div className="grid grid-cols-2 gap-2">
          <Field label="開店">
            <select value={form.business_hours_start} onChange={(e) => update("business_hours_start", e.target.value)} className={inputClass}>
              <option value="">未設定</option>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="閉店">
            <select value={form.business_hours_end} onChange={(e) => update("business_hours_end", e.target.value)} className={inputClass}>
              <option value="">未設定</option>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {hoursError ? <p role="alert" className="text-sm text-red-600">{hoursError}</p> : null}
        <fieldset>
          <legend className="mb-1 text-[13px] font-medium text-nicchyo-ink/70">使える決済</legend>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_OPTIONS.map((o) => (
              <label key={o.key} className="flex min-h-12 items-center gap-2 rounded-lg border border-line px-3">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={form.payment_methods.includes(o.key)}
                  onChange={(e) =>
                    update("payment_methods", e.target.checked ? [...form.payment_methods, o.key] : form.payment_methods.filter((k) => k !== o.key))
                  }
                />
                <span className="text-base">{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-[13px] font-medium text-nicchyo-ink/70">雨の日</legend>
          <div className="space-y-2">
            {RAIN_OPTIONS.map((o) => (
              <label key={o.key} className="flex min-h-12 items-center gap-2 rounded-lg border border-line px-3">
                <input type="radio" name="rain" className="h-5 w-5" checked={form.rain_policy === o.key} onChange={() => update("rain_policy", o.key)} />
                <span className="text-base">{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card title="SNS・ホームページ">
        <Field label="Instagram">
          <input value={form.sns_instagram} onChange={(e) => update("sns_instagram", e.target.value)} className={inputClass} />
        </Field>
        <Field label="X">
          <input value={form.sns_x} onChange={(e) => update("sns_x", e.target.value)} className={inputClass} />
        </Field>
        <Field label="ホームページ（https:// から）">
          <input value={form.sns_hp} inputMode="url" onChange={(e) => update("sns_hp", e.target.value)} className={inputClass} />
        </Field>
      </Card>

      <Card title="お店の位置" hint="お店の前で「いまの場所を記録する」を押すと、スマホの現在地をそのまま記録します。地図に指す必要はありません。記録するだけで、地図は変わりません。">
        <Field label={`店番（${MIN_SHOP_ID}〜${MAX_SHOP_ID}。住所録に無い新しい店は空のままでよい）`}>
          <input value={storeNumber} inputMode="numeric" onChange={(e) => setStoreNumber(e.target.value.replace(/\D/g, ""))} className={inputClass} />
        </Field>
        <button
          type="button"
          onClick={recordCurrentPosition}
          disabled={gpsBusy || locationBusy}
          className={`${buttonClass} w-full bg-nicchyo-ink text-white`}
        >
          {gpsBusy ? "現在地を取得中…" : locationBusy ? "記録しています…" : "いまの場所を記録する"}
        </button>
        <p className="text-[13px] text-nicchyo-ink/55">
          {shop.location_recorded || shop.store_number != null
            ? `記録済み: ${shop.store_number != null ? `店番 ${shop.store_number}` : "店番なし"}${
                recordedInfo?.source === "gps"
                  ? `・現在地${recordedInfo.accuracyM != null ? `（誤差 約${Math.round(recordedInfo.accuracyM)}m）` : ""}`
                  : recordedInfo?.source === "pin"
                    ? "・地図で指定"
                    : ""
              }`
            : "位置は未記録です"}
          。地図への反映は、地図編集で確かめてから行います。
        </p>
        <button
          type="button"
          onClick={() => setShowMap((v) => !v)}
          aria-expanded={showMap}
          className={`${buttonClass} w-full border border-line bg-white text-nicchyo-ink/80`}
        >
          {showMap ? "地図を閉じる" : "地図で位置を直す（任意）"}
        </button>
        {showMap ? (
          <>
            <p className="text-[13px] text-nicchyo-ink/55">
              地図をタップ（またはピンをドラッグ）して位置を決めます。緑の点は地図で配置済み、灰色は空きの区画です。点をタップするとその店番になります。
            </p>
            <LocationPicker locations={locations} value={pin} onChange={setPin} onPickStoreNumber={pickStoreNumber} />
            <button
              type="button"
              onClick={() => pin && void saveLocation(pin, { source: "pin", accuracyM: null })}
              disabled={locationBusy || !pin}
              className={`${buttonClass} w-full border border-nicchyo-ink bg-white text-nicchyo-ink`}
            >
              {locationBusy ? "記録しています…" : "この位置を記録"}
            </button>
          </>
        ) : null}
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 p-3 backdrop-blur lg:left-[248px]">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Link href="/admin/field" className={`${buttonClass} border border-line bg-white text-nicchyo-ink/70`}>
            一覧へ
          </Link>
          <button type="button" onClick={() => void save()} disabled={saving || !dirty || !!hoursError} className={`${buttonClass} flex-1 bg-green-600 text-white`}>
            {saving ? "保存しています…" : dirty ? "内容を保存" : "変更なし"}
          </button>
        </div>
      </div>
    </div>
  );
}
