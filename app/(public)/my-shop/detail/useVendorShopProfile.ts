import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { createClient } from "@/utils/supabase/client";

export type SeasonKey = "spring_summer" | "summer_autumn" | "autumn_winter" | "winter_spring";

export type ProductItem = {
  name: string;
  imageUrl?: string;
  seasons: SeasonKey[];
};

export type FormState = {
  name: string;
  ownerName: string;
  /** 店主名を地図・検索の公開画面に表示するか。既定は非公開。 */
  ownerNamePublic: boolean;
  category: string;
  stallStyle: string;
  highlight: string;
  imageMain: string;
  instagram: string;
  twitter: string;
  website: string;
};

export const SEASON_OPTIONS: { key: SeasonKey; label: string }[] = [
  { key: "spring_summer", label: "春ー夏" },
  { key: "summer_autumn", label: "夏ー秋" },
  { key: "autumn_winter", label: "秋ー冬" },
  { key: "winter_spring", label: "冬ー春" },
];

/** FormState のうちテキスト入力の項目だけを指すキー */
type TextFieldKey = {
  [K in keyof FormState]: FormState[K] extends string ? K : never;
}[keyof FormState];

const REQUIRED_FIELDS: TextFieldKey[] = [
  "name",
  "ownerName",
  "category",
  "highlight",
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
  ownerNamePublic: false,
  category: "",
  stallStyle: "",
  highlight: "",
  imageMain: "",
  instagram: "",
  twitter: "",
  website: "",
};

/**
 * 出店者の「出店情報の入力」フォーム（/my-shop/detail）の状態一式。
 *
 * Supabase からの読み込み・保存、フォームのバリデーション、商品の追加・季節設定まで、
 * この画面が持つ状態と操作をすべてここに集約する。画面（page.tsx）側はこれを呼び、
 * 返ってきた値をそのまま表示に使うだけにする。
 */
export function useVendorShopProfile() {
  const { user, permissions } = useAuth();
  const vendorId = user?.id ?? null;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [productError, setProductError] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [loadError, setLoadError] = useState("");

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
        .select("id, shop_name, strength, style, category_id, shop_image_url, sns_instagram, sns_x, sns_hp")
        .eq("id", vendorId)
        .single();

      if (vendorError || !vendor) {
        setLoadError("店舗情報を取得できませんでした。");
        setInitialized(true);
        return;
      }

      // 出店者名は vendors から分離され、公開可否を本人が管理する
      const { data: ownerProfile } = await supabase
        .from("vendor_owner_profiles")
        .select("owner_name, is_public")
        .eq("vendor_id", vendorId)
        .maybeSingle();

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
        ownerName: ownerProfile?.owner_name ?? "",
        ownerNamePublic: ownerProfile?.is_public ?? false,
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

      // 店主名は専用テーブルへ。公開可否も本人の設定として保存する。
      const { error: ownerProfileError } = await supabase
        .from("vendor_owner_profiles")
        .upsert(
          {
            vendor_id: vendorId,
            owner_name: form.ownerName.trim() || null,
            is_public: form.ownerNamePublic,
          },
          { onConflict: "vendor_id" }
        );
      if (ownerProfileError) {
        throw ownerProfileError;
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

  return {
    vendorId,
    form,
    setForm,
    errors,
    productError,
    statusMessage,
    loadError,
    products,
    productName,
    setProductName,
    productImageUrl,
    setProductImageUrl,
    productSeasons,
    showProductOptions,
    handleChange,
    handleProductRegister,
    toggleSeason,
    handleProductConfirm,
    handleSubmit,
  };
}
