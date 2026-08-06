"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";
import { getShopBannerImage } from "@/lib/shopImages";

type SeasonKey = "spring_summer" | "summer_autumn" | "autumn_winter" | "winter_spring";

type ProductItem = {
  name: string;
  imageUrl?: string;
  seasons: SeasonKey[];
};

type FormState = {
  name: string;
  ownerName: string;
  category: string;
  stallStyle: string;
  highlight: string;
  imageMain: string;
  instagram: string;
  twitter: string;
  website: string;
};

const CATEGORIES = [
  "食材",
  "食べ物",
  "道具・工具",
  "生活雑貨",
  "植物・苗",
  "アクセサリー",
  "手作り・工芸",
];

const SEASON_OPTIONS: { key: SeasonKey; label: string }[] = [
  { key: "spring_summer", label: "春ー夏" },
  { key: "summer_autumn", label: "夏ー秋" },
  { key: "autumn_winter", label: "秋ー冬" },
  { key: "winter_spring", label: "冬ー春" },
];

const REQUIRED_FIELDS: (keyof FormState)[] = [
  "name",
  "ownerName",
  "category",
  "highlight",
];

const ILLUSTRATION_OPTIONS = [
  {
    id: "obaasan",
    label: "おせっかいばあちゃん",
    src: "/images/obaasan_transparent.png",
  },
];

const SEASON_ID_MAP: Record<SeasonKey, number> = {
  spring_summer: 0,
  summer_autumn: 1,
  autumn_winter: 2,
  winter_spring: 3,
};

const EMPTY_FORM: FormState = {
  name: "",
  ownerName: "",
  category: "",
  stallStyle: "",
  highlight: "",
  imageMain: "",
  instagram: "",
  twitter: "",
  website: "",
};

export default function MyShopDetailPage() {
  const { user, permissions } = useAuth();
  const vendorId = user?.id ?? null;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [productError, setProductError] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [editBasic, setEditBasic] = useState(false);
  const [editStall, setEditStall] = useState(false);
  const [editHighlight, setEditHighlight] = useState(false);
  const [editProducts, setEditProducts] = useState(false);
  const [editImages, setEditImages] = useState(false);
  const [editLinks, setEditLinks] = useState(false);
  const [selectedIllustration, setSelectedIllustration] = useState(
    "/images/obaasan_transparent.png"
  );
  const [showIllustrationOptions, setShowIllustrationOptions] = useState(false);
  useEffect(() => {
    if (!editHighlight) {
      setShowIllustrationOptions(false);
    }
  }, [editHighlight]);

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [productName, setProductName] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [productSeasons, setProductSeasons] = useState<Set<SeasonKey>>(new Set());
  const [showProductOptions, setShowProductOptions] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!vendorId || initialized) return;
      setLoadError("");
      const supabase = createClient();

      const { data: vendor, error: vendorError } = await supabase
        .from("vendors")
        .select("id, shop_name, owner_name, strength, style, category_id, shop_image_url, sns_instagram, sns_x, sns_hp")
        .eq("id", vendorId)
        .single();

      if (vendorError || !vendor) {
        setLoadError("店舗情報を取得できませんでした。");
        setInitialized(true);
        return;
      }

      let categoryName = "";
      if (vendor.category_id) {
        const { data: category } = await supabase
          .from("categories")
          .select("name")
          .eq("id", vendor.category_id)
          .single();
        categoryName = category?.name ?? "";
      }

      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, image_url")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: true });

      const productIds = productsData?.map((item) => item.id) ?? [];
      const { data: seasonRows } = productIds.length
        ? await supabase
            .from("product_seasons")
            .select("product_id, season_id")
            .in("product_id", productIds)
        : { data: [] };

      const seasonMap: Record<number, SeasonKey> = {
        0: "spring_summer",
        1: "summer_autumn",
        2: "autumn_winter",
        3: "winter_spring",
      };

      const seasonsByProduct = new Map<string, SeasonKey[]>();
      (seasonRows ?? []).forEach((row) => {
        const key = row.product_id;
        const seasonKey = seasonMap[row.season_id];
        if (!seasonKey) return;
        const existing = seasonsByProduct.get(key) ?? [];
        existing.push(seasonKey);
        seasonsByProduct.set(key, existing);
      });

      setForm({
        name: vendor.shop_name ?? "",
        ownerName: vendor.owner_name ?? "",
        category: categoryName,
        stallStyle: vendor.style ?? "",
        highlight: vendor.strength ?? "",
        imageMain: vendor.shop_image_url ?? "",
        instagram: vendor.sns_instagram ?? "",
        twitter: vendor.sns_x ?? "",
        website: vendor.sns_hp ?? "",
      });

      setProducts(
        (productsData ?? []).map((item) => ({
          name: item.name,
          imageUrl: item.image_url ?? undefined,
          seasons: seasonsByProduct.get(item.id) ?? [],
        }))
      );

      setInitialized(true);
    };

    loadProfile();
  }, [vendorId, initialized]);

  const handleChange =
    (key: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setForm((prev) => ({ ...prev, [key]: value }));
      if (errors[key]) {
        setErrors((prev) => ({ ...prev, [key]: undefined }));
      }
    };

  const handleProductRegister = () => {
    setProductError("");
    const trimmed = productName.trim();
    if (!trimmed) {
      setProductError("商品名を入力してください。");
      return;
    }
    setShowProductOptions(true);
  };

  const handleIllustrationToggle = () => {
    if (!editHighlight) return;
    setShowIllustrationOptions((prev) => !prev);
  };

  const toggleSeason = (key: SeasonKey) => {
    setProductSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleProductConfirm = () => {
    const trimmed = productName.trim();
    if (!trimmed) {
      setProductError("商品名を入力してください。");
      return;
    }
    const nextItem: ProductItem = {
      name: trimmed,
      imageUrl: productImageUrl.trim() || undefined,
      seasons: Array.from(productSeasons),
    };
    setProducts((prev) => [...prev, nextItem]);
    setProductName("");
    setProductImageUrl("");
    setProductSeasons(new Set());
    setShowProductOptions(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("");
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    REQUIRED_FIELDS.forEach((key) => {
      if (!form[key].trim()) {
        nextErrors[key] = "必須項目です。";
      }
    });
    if (products.length === 0) {
      setProductError("商品を1つ以上登録してください。");
    }
    if (Object.keys(nextErrors).length > 0 || products.length === 0) {
      setErrors(nextErrors);
      return;
    }

    if (!vendorId || !permissions.isVendor) {
      setStatusMessage("出店者としてログインしてください。");
      return;
    }

    const supabase = createClient();
    try {
      const categoryValue = form.category.trim();
      let categoryId: string | null = null;
      if (categoryValue) {
        const { data: categoryRow, error: categoryError } = await supabase
          .from("categories")
          .select("id")
          .eq("name", categoryValue)
          .maybeSingle();
        if (categoryError) {
          throw categoryError;
        }
        if (categoryRow) {
          categoryId = categoryRow.id;
        } else {
          const { data: insertedCategory, error: insertCategoryError } = await supabase
            .from("categories")
            .insert({ name: categoryValue })
            .select("id")
            .maybeSingle();
          if (insertCategoryError) {
            throw insertCategoryError;
          }
          categoryId = insertedCategory?.id ?? null;
        }
      }

      const vendorPayload = {
        shop_name: form.name.trim(),
        owner_name: form.ownerName.trim() || null,
        strength: form.highlight.trim() || null,
        style: form.stallStyle.trim() || null,
        category_id: categoryId,
        shop_image_url: form.imageMain.trim() || null,
        sns_instagram: form.instagram.trim() || null,
        sns_x: form.twitter.trim() || null,
        sns_hp: form.website.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const { error: vendorError } = await supabase
        .from("vendors")
        .update(vendorPayload)
        .eq("id", vendorId);
      if (vendorError) {
        throw vendorError;
      }

      const { error: deleteProductsError } = await supabase
        .from("products")
        .delete()
        .eq("vendor_id", vendorId);
      if (deleteProductsError) {
        throw deleteProductsError;
      }

      if (products.length > 0) {
        const payloads = products.map((product) => ({
          vendor_id: vendorId,
          name: product.name,
          ...(product.imageUrl ? { image_url: product.imageUrl } : {}),
        }));
        const { data: insertedProducts, error: insertProductError } = await supabase
          .from("products")
          .insert(payloads)
          .select("id,name");
        if (insertProductError) {
          throw insertProductError;
        }

        const productIdMap = new Map<string, string>();
        (insertedProducts ?? []).forEach((entry) => {
          if (entry.name && entry.id) {
            productIdMap.set(entry.name, entry.id);
          }
        });

        const seasonRows: { product_id: string; season_id: number }[] = [];
        products.forEach((product) => {
          const productId = productIdMap.get(product.name);
          product.seasons.forEach((seasonKey) => {
            const seasonId = SEASON_ID_MAP[seasonKey];
            if (productId && seasonId !== undefined) {
              seasonRows.push({
                product_id: productId,
                season_id: seasonId,
              });
            }
          });
        });

        if (seasonRows.length > 0) {
          const { error: seasonError } = await supabase
            .from("product_seasons")
            .insert(seasonRows);
          if (seasonError) {
            throw seasonError;
          }
        }
      }

      setStatusMessage("更新内容をSupabaseに保存しました。");
    } catch (error) {
      console.error(error);
      setStatusMessage(
        error instanceof Error ? `更新に失敗しました: ${error.message}` : "更新に失敗しました。"
      );
    }
  };

  const requiredMark = (
    <span className="ml-1 text-[11px] font-semibold text-rose-600">*</span>
  );

  const fieldClass = (key: keyof FormState) =>
    `mt-1 w-full rounded-xl border px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none ${
      errors[key]
        ? "border-rose-400 focus:border-rose-500"
        : "border-orange-200 focus:border-amber-400"
    }`;

  const bannerImageUrl =
    form.imageMain.trim() || getShopBannerImage(form.category, vendorId ?? "default");

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 pb-24">
      <div className="mx-auto w-full max-w-4xl px-4 pt-6">
        <div className="mb-4 rounded-2xl border border-amber-100 bg-white/95 px-6 py-5 text-center shadow-sm">
          <p className="text-base font-semibold uppercase tracking-[0.14em] text-amber-700">
            My shop
          </p>
          <h1 className="mt-1 text-5xl font-bold text-slate-900">
            出店情報の入力
          </h1>
        </div>
        <div className="mb-4 flex items-center justify-center gap-3">
          <Link
            href="/my-shop"
            className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50"
          >
            ← 出店者メニューへ戻る
          </Link>
        </div>
        {loadError && (
          <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {loadError}
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit} noValidate>
          <section className="overflow-hidden rounded-3xl border border-orange-200 bg-white shadow-sm">
            <div className="relative -mx-0 overflow-hidden border-b border-slate-200 bg-white">
              <Image
                src={bannerImageUrl}
                alt="ショップバナー"
                width={960}
                height={640}
                className="h-56 w-full object-cover object-center md:h-72"
                priority
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
              <button
                type="button"
                onClick={() => setEditImages(true)}
                className="absolute right-4 top-4 rounded-full border border-white/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white"
              >
                編集する
              </button>
            </div>

            <div className="px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-3xl font-semibold text-slate-900">
                    {form.name || "未入力"}
                  </h2>
                  <p className="mt-1 text-base text-slate-600">
                    {form.ownerName || "店主名未入力"}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-500">商品ジャンル</span>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                      {form.category || "商品ジャンル未選択"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditBasic((prev) => !prev)}
                  className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50"
                >
                  {editBasic ? "閉じる" : "編集する"}
                </button>
              </div>

              {editBasic && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block text-sm text-slate-700">
                    店舗名{requiredMark}
                    <input
                      type="text"
                      value={form.name}
                      onChange={handleChange("name")}
                      placeholder="例: 旬の野菜やさん"
                      className={fieldClass("name")}
                      aria-invalid={!!errors.name}
                      required
                    />
                    {errors.name && (
                      <span className="mt-1 block text-[11px] text-rose-600">
                        {errors.name}
                      </span>
                    )}
                  </label>
                  <label className="block text-sm text-slate-700">
                    店主名{requiredMark}
                    <input
                      type="text"
                      value={form.ownerName}
                      onChange={handleChange("ownerName")}
                      placeholder="例: 山田 花子"
                      className={fieldClass("ownerName")}
                      aria-invalid={!!errors.ownerName}
                      required
                    />
                    {errors.ownerName && (
                      <span className="mt-1 block text-[11px] text-rose-600">
                        {errors.ownerName}
                      </span>
                    )}
                  </label>
                  <label className="block text-sm text-slate-700">
                    商品ジャンル{requiredMark}
                    <select
                      value={form.category}
                      onChange={handleChange("category")}
                      className={fieldClass("category")}
                      aria-invalid={!!errors.category}
                      required
                    >
                      <option value="">選択してください</option>
                      {CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    {errors.category && (
                      <span className="mt-1 block text-[11px] text-rose-600">
                        {errors.category}
                      </span>
                    )}
                  </label>
                </div>
              )}
            </div>

            <div className="divide-y divide-slate-200 px-6 pb-6">
              <section className="py-6 text-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      aria-label="紹介コメントイラスト"
                    onClick={handleIllustrationToggle}
                      className="h-16 w-16 rounded-full border border-amber-200 bg-white p-2 shadow-sm transition hover:border-amber-300"
                    >
                      <Image
                        src={selectedIllustration}
                        alt="にちよおばあちゃん"
                        width={64}
                        height={64}
                        className="h-full w-full rounded-full object-cover"
                      />
                    </button>
                    <div>
                      <p className="text-sm font-semibold text-slate-500">紹介コメント</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditHighlight((prev) => !prev)}
                    className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50"
                  >
                    {editHighlight ? "閉じる" : "編集する"}
                  </button>
                </div>
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-base leading-relaxed text-slate-700">
                  {form.highlight || "未入力"}
                </div>
                {editHighlight && (
                  <div className="mt-4">
                    <label className="block text-sm text-slate-700">
                      お店のイチ押しポイント{requiredMark}
                    <textarea
                      rows={4}
                      value={form.highlight}
                      onChange={handleChange("highlight")}
                      placeholder="例: 朝採れ野菜をその場で袋詰めします"
                      className={fieldClass("highlight")}
                      aria-invalid={!!errors.highlight}
                      required
                    />
                      {errors.highlight && (
                        <span className="mt-1 block text-[11px] text-rose-600">
                          {errors.highlight}
                        </span>
                      )}
                    </label>
                  </div>
                )}
                {editHighlight && showIllustrationOptions && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {ILLUSTRATION_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setSelectedIllustration(option.src);
                          setShowIllustrationOptions(false);
                        }}
                        className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                          selectedIllustration === option.src
                            ? "border-amber-400 bg-amber-50 text-amber-800"
                            : "border-slate-200 bg-white text-slate-900"
                        }`}
                      >
                        <Image
                          src={option.src}
                          alt={option.label}
                          width={64}
                          height={64}
                          className="h-16 w-16 rounded-full object-cover"
                        />
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="py-6 text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-500">商品</p>
                  <button
                    type="button"
                    onClick={() => setEditProducts((prev) => !prev)}
                    className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50"
                  >
                    {editProducts ? "閉じる" : "編集する"}
                  </button>
                </div>
                {!editProducts ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {products.length > 0 ? (
                      products.map((product, index) => (
                        <div
                          key={`${product.name}-${index}`}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm"
                        >
                          {product.name}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">
                        まだ商品が登録されていません。
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end">
                      <label className="flex-1 text-sm text-slate-700">
                        商品名{requiredMark}
                        <input
                          type="text"
                          value={productName}
                          onChange={(event) => setProductName(event.target.value)}
                          placeholder="例: トマト"
                          className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleProductRegister}
                        className="h-10 rounded-full bg-amber-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500"
                      >
                        登録
                      </button>
                    </div>
                    {productError && (
                      <span className="block text-[11px] text-rose-600">
                        {productError}
                      </span>
                    )}

                    {showProductOptions && (
                      <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                        <p className="text-sm font-semibold text-amber-800">
                          写真登録・季節の設定（スキップ可）
                        </p>
                        <div className="mt-3 space-y-3">
                          <label className="block text-sm text-slate-700">
                            写真URL
                            <input
                              type="url"
                              value={productImageUrl}
                              onChange={(event) => setProductImageUrl(event.target.value)}
                              placeholder="https://example.com/product.jpg"
                              className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900"
                            />
                          </label>
                          <div>
                            <p className="text-sm text-slate-700">季節</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {SEASON_OPTIONS.map((option) => (
                                <button
                                  key={option.key}
                                  type="button"
                                  onClick={() => toggleSeason(option.key)}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                                    productSeasons.has(option.key)
                                      ? "border-amber-400 bg-amber-200 text-amber-900"
                                      : "border-amber-200 bg-white text-amber-700"
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleProductConfirm}
                            className="rounded-full bg-amber-700 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
                          >
                            確定する
                          </button>
                        </div>
                      </div>
                    )}

                    {products.length > 0 && (
                      <div className="rounded-2xl border border-amber-100 bg-white p-4">
                        <p className="text-sm font-semibold text-slate-700">
                          登録済みの商品
                        </p>
                        <div className="mt-3 space-y-2">
                          {products.map((product, index) => (
                            <div
                              key={`${product.name}-${index}`}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">{product.name}</span>
                                {product.imageUrl && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                    写真あり
                                  </span>
                                )}
                                {product.seasons.map((season) => (
                                  <span
                                    key={`${product.name}-${season}`}
                                    className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700"
                                  >
                                    {SEASON_OPTIONS.find((opt) => opt.key === season)?.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="py-6 text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-500">出店スタイル</p>
                  <button
                    type="button"
                    onClick={() => setEditStall((prev) => !prev)}
                    className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50"
                  >
                    {editStall ? "閉じる" : "編集する"}
                  </button>
                </div>
                {!editStall ? (
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {form.stallStyle || "未入力"}
                  </p>
                ) : (
                  <div className="mt-3">
                    <label className="block text-sm text-slate-700">
                      出店スタイル
                    <textarea
                      rows={4}
                      value={form.stallStyle}
                      onChange={handleChange("stallStyle")}
                      placeholder="例: テント出店 / ワゴン"
                      className={fieldClass("stallStyle")}
                    />
                    </label>
                  </div>
                )}
              </section>

              <section className="py-6 text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-500">写真</p>
                  <button
                    type="button"
                    onClick={() => setEditImages((prev) => !prev)}
                    className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50"
                  >
                    {editImages ? "閉じる" : "編集する"}
                  </button>
                </div>
                {!editImages ? (
                  <div className="mt-3 text-sm text-slate-600">
                    {form.imageMain
                      ? "登録済みの写真URLがあります。"
                      : "写真URLが未入力です。"}
                  </div>
                ) : (
                  <div className="mt-3 grid gap-3">
                    <label className="block text-sm text-slate-700">
                      メイン画像URL
                      <input
                        type="url"
                        value={form.imageMain}
                        onChange={handleChange("imageMain")}
                        placeholder="https://example.com/main.jpg"
                        className={fieldClass("imageMain")}
                      />
                      <span className="mt-1 block text-[11px] text-slate-500">
                        このURLは店舗バナーやマップ表示にそのまま反映されます。
                      </span>
                    </label>
                  </div>
                )}
              </section>

              <section className="py-6 text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-500">SNS・外部リンク</p>
                  <button
                    type="button"
                    onClick={() => setEditLinks((prev) => !prev)}
                    className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50"
                  >
                    {editLinks ? "閉じる" : "編集する"}
                  </button>
                </div>
                {!editLinks ? (
                  <div className="mt-3 text-sm text-slate-600">
                    {form.instagram || form.twitter || form.website
                      ? "登録済みのリンクがあります。"
                      : "リンクが未入力です。"}
                  </div>
                ) : (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="block text-sm text-slate-700">
                      Instagram
                      <input
                        type="url"
                        value={form.instagram}
                        onChange={handleChange("instagram")}
                        placeholder="https://instagram.com/..."
                        className={fieldClass("instagram")}
                      />
                    </label>
                    <label className="block text-sm text-slate-700">
                      X (Twitter)
                      <input
                        type="url"
                        value={form.twitter}
                        onChange={handleChange("twitter")}
                        placeholder="https://x.com/..."
                        className={fieldClass("twitter")}
                      />
                    </label>
                    <label className="block text-sm text-slate-700">
                      Webサイト
                      <input
                        type="url"
                        value={form.website}
                        onChange={handleChange("website")}
                        placeholder="https://example.com"
                        className={fieldClass("website")}
                      />
                    </label>
                  </div>
                )}
              </section>
            </div>
          </section>

          {statusMessage && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              {statusMessage}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-full bg-amber-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500"
            >
              変更を保存する
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
