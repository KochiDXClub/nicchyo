"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth/AuthContext";
import { fetchVendorStore, saveVendorStore, uploadStoreImage, fetchCategories } from "../_services/storeService";
import type { Category } from "../_services/storeService";
import type { PaymentMethod, RainPolicy, Store } from "../_types";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Plus,
  X,
  Store as StoreIcon,
  CreditCard,
  CloudRain,
  CalendarDays,
  Loader2,
  Tent,
  Tag,
  Camera,
  Clock,
  Link as LinkIcon,
  Instagram,
  Globe,
} from "lucide-react";

const PAYMENT_OPTIONS: { key: PaymentMethod; label: string; emoji: string }[] = [
  { key: "cash",   label: "現金",      emoji: "💴" },
  { key: "card",   label: "カード",    emoji: "💳" },
  { key: "paypay", label: "PayPay",   emoji: "📱" },
  { key: "ic",     label: "交通系IC", emoji: "🚃" },
];

const RAIN_OPTIONS: { key: RainPolicy; label: string; desc: string }[] = [
  { key: "outdoor",  label: "雨でも出店",              desc: "雨天でも通常通り出店" },
  { key: "cancel",   label: "雨天中止",                desc: "雨天時は出店しない" },
  { key: "undecided",label: "当日判断（SNSで告知）",   desc: "当日SNSで告知" },
];

const WEEKDAY_OPTIONS = [
  "毎週日曜日", "毎週土曜日",
  "第1日曜日", "第2日曜日", "第3日曜日", "第4日曜日",
  "第2・第4土曜日", "不定期",
];

const STYLE_PRESETS = [
  "午前中心に出店",
  "午後中心に出店",
  "終日出店",
  "雑談歓迎",
  "試食あり",
  "常設ブース",
];

const TIME_OPTIONS = Array.from({ length: 19 }, (_, i) => {
  const h = i + 6; // 6:00〜24:00
  return `${h}:00`;
});

const EMPTY_STORE: Store = {
  id: "", vendor_id: "",
  name: "", owner_name: "", category_id: "", style: "", style_tags: [], main_products: [],
  main_product_prices: {},
  payment_methods: [], rain_policy: "undecided", schedule: [],
};

function SectionHeader({ icon: Icon, title }: { icon: typeof StoreIcon; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
        <Icon size={14} />
      </div>
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
    </div>
  );
}

export default function VendorStorePage() {
  const { user } = useAuth();
  const [form, setForm]           = useState<Store>(EMPTY_STORE);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newProduct, setNewProduct] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newStyleTag, setNewStyleTag] = useState("");
  const [newSchedule, setNewSchedule] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving]   = useState(false);
  const [isSaved, setIsSaved]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // 店舗写真
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 離脱警告
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    fetchCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchVendorStore(user.id)
      .then((store) => {
        if (store) {
          setForm(store);
          if (store.shop_image_url) setImagePreview(store.shop_image_url);
        } else {
          setForm({ ...EMPTY_STORE, id: user.id, vendor_id: user.id });
        }
      })
      .catch(() => setError("データの読み込みに失敗しました"))
      .finally(() => setIsLoading(false));
  }, [user]);

  // 離脱警告（未保存の変更がある場合のみ）
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setIsDirty(true);
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    setForm((prev) => ({ ...prev, shop_image_url: undefined }));
    setIsDirty(true);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSaving || !user) return;
    setIsSaving(true);
    setError(null);
    try {
      let imageUrl = form.shop_image_url;
      if (imageFile) {
        imageUrl = await uploadStoreImage(user.id, imageFile);
      }
      await saveVendorStore(user.id, {
        name: form.name,
        owner_name: form.owner_name,
        category_id: form.category_id,
        style: form.style,
        style_tags: form.style_tags,
        main_products: form.main_products,
        main_product_prices: form.main_product_prices,
        payment_methods: form.payment_methods,
        rain_policy: form.rain_policy,
        schedule: form.schedule,
        shop_image_url: imageUrl,
        sns_instagram: form.sns_instagram,
        sns_x: form.sns_x,
        sns_hp: form.sns_hp,
        business_hours_start: form.business_hours_start,
        business_hours_end: form.business_hours_end,
      });
      setForm((prev) => ({ ...prev, shop_image_url: imageUrl }));
      setImageFile(null);
      setIsDirty(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch {
      setError("保存に失敗しました。もう一度お試しください。");
    } finally {
      setIsSaving(false);
    }
  }

  function togglePayment(method: PaymentMethod) {
    setIsDirty(true);
    setForm((prev) => ({
      ...prev,
      payment_methods: prev.payment_methods.includes(method)
        ? prev.payment_methods.filter((m) => m !== method)
        : [...prev.payment_methods, method],
    }));
  }

  function addStyleTag(value: string) {
    const trimmed = value.trim();
    if (!trimmed || form.style_tags.includes(trimmed)) return;
    setIsDirty(true);
    setForm((prev) => ({ ...prev, style_tags: [...prev.style_tags, trimmed] }));
    setNewStyleTag("");
  }

  function removeStyleTag(tag: string) {
    setIsDirty(true);
    setForm((prev) => ({ ...prev, style_tags: prev.style_tags.filter((t) => t !== tag) }));
  }

  function addProduct() {
    const trimmed = newProduct.trim();
    if (!trimmed || form.main_products.includes(trimmed)) return;
    const price = newProductPrice.trim() !== "" ? parseInt(newProductPrice, 10) : null;
    setIsDirty(true);
    setForm((prev) => ({
      ...prev,
      main_products: [...prev.main_products, trimmed],
      main_product_prices: { ...prev.main_product_prices, [trimmed]: isNaN(price as number) ? null : price },
    }));
    setNewProduct("");
    setNewProductPrice("");
  }

  function removeProduct(name: string) {
    setIsDirty(true);
    setForm((prev) => {
      const prices = { ...prev.main_product_prices };
      delete prices[name];
      return { ...prev, main_products: prev.main_products.filter((p) => p !== name), main_product_prices: prices };
    });
  }

  function updateProductPrice(name: string, value: string) {
    const price = value.trim() === "" ? null : parseInt(value, 10);
    setIsDirty(true);
    setForm((prev) => ({
      ...prev,
      main_product_prices: { ...prev.main_product_prices, [name]: isNaN(price as number) ? null : price },
    }));
  }

  function addSchedule(value: string) {
    if (!value || form.schedule.includes(value)) return;
    setIsDirty(true);
    setForm((prev) => ({ ...prev, schedule: [...prev.schedule, value] }));
    setNewSchedule("");
  }

  function removeSchedule(s: string) {
    setIsDirty(true);
    setForm((prev) => ({ ...prev, schedule: prev.schedule.filter((x) => x !== s) }));
  }

  const summaryCards = [
    { label: "店舗名", value: form.name.trim() || "未設定" },
    { label: "商品", value: `${form.main_products.length}件` },
    { label: "決済", value: `${form.payment_methods.length}種` },
    { label: "出店日", value: `${form.schedule.length}件` },
  ];

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFAF0]">
        <Loader2 size={28} className="animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFAF0] pb-24">
      <div className="border-b border-amber-100 bg-white/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href="/my-shop"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-600">Store Info</p>
            <h1 className="text-xl font-bold text-slate-900">店舗情報の編集</h1>
          </div>
          {isDirty && (
            <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
              未保存
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} onChange={() => setIsDirty(true)} className="mx-auto max-w-2xl space-y-5 px-4 pt-5">

        {error && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="rounded-3xl border border-amber-100 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600">Store Info</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">お店の基本情報</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            まずは「名前」「商品」「決済方法」「出店予定日」を整えると、お客さんが安心して来店できます。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {summaryCards.map((item) => (
              <div key={item.label} className="rounded-2xl bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-semibold text-slate-500">{item.label}</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 店舗写真 */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader icon={Camera} title="店舗写真" />
          {imagePreview ? (
            <div className="relative">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <Image
                  src={imagePreview}
                  alt="店舗写真プレビュー"
                  width={800}
                  height={400}
                  className="h-48 w-full object-cover"
                  unoptimized={imagePreview.startsWith("blob:")}
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              </div>
              <button
                type="button"
                onClick={removeImage}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-800/70 text-white hover:bg-slate-900/80"
              >
                <X size={14} />
              </button>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
              >
                写真を変更する
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 text-slate-500 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
            >
              <Camera size={28} />
              <span className="text-sm font-medium">タップして写真を選択</span>
              <span className="text-xs text-slate-400">JPG・PNG・WebP / 最大5MB</span>
            </button>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageChange}
            className="hidden"
          />
          <p className="mt-1.5 text-[10px] text-slate-400">
            マップの吹き出し・お店ページのバナーに表示されます
          </p>
        </div>

        {/* 店舗名 */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader icon={StoreIcon} title="店舗名" />
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="例：山田農園"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>

        {/* 店主名（任意） */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader icon={StoreIcon} title="店主名（任意）" />
          <input
            type="text"
            value={form.owner_name ?? ""}
            onChange={(e) => setForm((prev) => ({ ...prev, owner_name: e.target.value }))}
            placeholder="例：山田 太郎"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
          />
          <p className="mt-1.5 text-[10px] text-slate-400">AIばあちゃんが店主名を案内するときに使用します</p>
        </div>

        {/* 商品ジャンル */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader icon={Tag} title="商品ジャンル" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {categories.map((cat) => {
              const isSelected = form.category_id === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { setIsDirty(true); setForm((prev) => ({ ...prev, category_id: isSelected ? "" : cat.id })); }}
                  className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition ${
                    isSelected
                      ? "border-amber-400 bg-amber-50 text-amber-800"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-amber-200"
                  }`}
                >
                  {cat.name}
                  {isSelected && <CheckCircle2 size={14} className="flex-shrink-0 text-amber-500" />}
                </button>
              );
            })}
          </div>
          {categories.length === 0 && (
            <p className="text-xs text-slate-400">カテゴリーを読み込み中...</p>
          )}
        </div>

        {/* 出店スタイル */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader icon={Tent} title="出店スタイル" />
          <div className="mb-3 flex flex-wrap gap-2">
            {form.style_tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
                {tag}
                <button type="button" onClick={() => removeStyleTag(tag)} className="text-amber-400 hover:text-amber-700">
                  <X size={12} />
                </button>
              </span>
            ))}
            {form.style_tags.length === 0 && (
              <span className="text-xs text-slate-400">スタイルを追加してください</span>
            )}
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {STYLE_PRESETS.filter((p) => !form.style_tags.includes(p)).map((preset) => (
              <button key={preset} type="button" onClick={() => addStyleTag(preset)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
              >
                + {preset}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text" value={newStyleTag}
              onChange={(e) => setNewStyleTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStyleTag(newStyleTag); } }}
              placeholder="その他のスタイルを入力..."
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300"
            />
            <button type="button" onClick={() => addStyleTag(newStyleTag)}
              className="flex items-center gap-1 rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-200"
            >
              <Plus size={14} />追加
            </button>
          </div>
          <textarea
            value={form.style}
            onChange={(e) => setForm((prev) => ({ ...prev, style: e.target.value }))}
            placeholder="一言コメント（例：試食あり・数量限定など）"
            rows={2}
            className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-300 resize-none"
          />
        </div>

        {/* 主な商品 */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader icon={StoreIcon} title="主な商品" />
          <div className="mb-3 space-y-2">
            {form.main_products.map((p) => (
              <div key={p} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                  {p}
                </span>
                <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                  <span className="text-xs text-slate-400">¥</span>
                  <input
                    type="number"
                    min={0}
                    value={form.main_product_prices[p] ?? ""}
                    onChange={(e) => updateProductPrice(p, e.target.value)}
                    placeholder="未設定"
                    className="w-20 bg-transparent text-right text-sm text-slate-700 outline-none"
                  />
                </div>
                <button type="button" onClick={() => removeProduct(p)} className="flex-shrink-0 text-slate-300 hover:text-rose-400">
                  <X size={16} />
                </button>
              </div>
            ))}
            {form.main_products.length === 0 && (
              <span className="text-xs text-slate-400">商品を追加してください</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text" value={newProduct}
              onChange={(e) => setNewProduct(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addProduct(); } }}
              placeholder="商品名..."
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300"
            />
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2">
              <span className="text-xs text-slate-400">¥</span>
              <input
                type="number"
                min={0}
                value={newProductPrice}
                onChange={(e) => setNewProductPrice(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addProduct(); } }}
                placeholder="金額"
                className="w-20 bg-transparent py-2 text-right text-sm text-slate-700 outline-none"
              />
            </div>
            <button type="button" onClick={addProduct} className="flex items-center gap-1 rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-200">
              <Plus size={14} />追加
            </button>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">金額は任意です。未入力でも追加できます。</p>
        </div>

        {/* 営業時間 */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader icon={Clock} title="営業時間（任意）" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <select
              value={form.business_hours_start ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, business_hours_start: e.target.value || undefined }))}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
            >
              <option value="">開始時間</option>
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="hidden text-center text-sm text-slate-500 sm:block">〜</span>
            <select
              value={form.business_hours_end ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, business_hours_end: e.target.value || undefined }))}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
            >
              <option value="">終了時間</option>
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* 決済方法 */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader icon={CreditCard} title="決済方法" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PAYMENT_OPTIONS.map((opt) => {
              const isSelected = form.payment_methods.includes(opt.key);
              return (
                <button key={opt.key} type="button" onClick={() => togglePayment(opt.key)}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition ${isSelected ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-amber-200"}`}
                >
                  <span className="text-base">{opt.emoji}</span>
                  {opt.label}
                  {isSelected && <CheckCircle2 size={14} className="ml-auto text-amber-500" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 雨天時対応 */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader icon={CloudRain} title="雨天時対応" />
          <div className="space-y-2">
            {RAIN_OPTIONS.map((opt) => {
              const isSelected = form.rain_policy === opt.key;
              return (
                <button key={opt.key} type="button"
                  onClick={() => { setIsDirty(true); setForm((prev) => ({ ...prev, rain_policy: opt.key })); }}
                  className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition ${isSelected ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-slate-50 hover:border-amber-200"}`}
                >
                  <div>
                    <p className={`text-sm font-semibold ${isSelected ? "text-amber-800" : "text-slate-700"}`}>{opt.label}</p>
                    <p className="text-xs text-slate-400">{opt.desc}</p>
                  </div>
                  {isSelected && <CheckCircle2 size={16} className="flex-shrink-0 text-amber-500" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 出店予定日 */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader icon={CalendarDays} title="出店予定日" />
          <div className="mb-3 flex flex-wrap gap-2">
            {form.schedule.map((s) => (
              <span key={s} className="flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-medium text-sky-800">
                {s}
                <button type="button" onClick={() => removeSchedule(s)} className="text-sky-400 hover:text-sky-700">
                  <X size={12} />
                </button>
              </span>
            ))}
            {form.schedule.length === 0 && <span className="text-xs text-slate-400">出店日を追加してください</span>}
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {WEEKDAY_OPTIONS.filter((w) => !form.schedule.includes(w)).map((w) => (
              <button key={w} type="button" onClick={() => addSchedule(w)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
              >
                + {w}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text" value={newSchedule}
              onChange={(e) => setNewSchedule(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSchedule(newSchedule.trim()); } }}
              placeholder="その他の日程を入力..."
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300"
            />
            <button type="button" onClick={() => addSchedule(newSchedule.trim())}
              className="flex items-center gap-1 rounded-xl bg-sky-100 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-200"
            >
              <Plus size={14} />追加
            </button>
          </div>
        </div>

        {/* SNSリンク */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader icon={LinkIcon} title="SNS・ウェブサイト（任意）" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-pink-100 text-pink-600">
                <Instagram size={16} />
              </span>
              <input
                type="text"
                value={form.sns_instagram ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, sns_instagram: e.target.value || undefined }))}
                placeholder="@username または URL"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                𝕏
              </span>
              <input
                type="text"
                value={form.sns_x ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, sns_x: e.target.value || undefined }))}
                placeholder="@username または URL"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                <Globe size={16} />
              </span>
              <input
                type="text"
                value={form.sns_hp ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, sns_hp: e.target.value || undefined }))}
                placeholder="https://example.com"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">お店ページに表示されます。@は省略可能です。</p>
        </div>

        {/* 保存ボタン */}
        <button type="submit" disabled={isSaving}
          className={`flex w-full items-center justify-center gap-2 rounded-3xl py-4 text-base font-bold shadow transition ${
            isSaving ? "cursor-not-allowed bg-slate-200 text-slate-400"
            : isSaved  ? "bg-emerald-500 text-white"
            : "bg-amber-500 text-white hover:bg-amber-400"
          }`}
        >
          {isSaving ? <><Loader2 size={18} className="animate-spin" />保存中...</>
          : isSaved  ? <><CheckCircle2 size={18} />保存しました！</>
          : <><Save size={18} />変更を保存する</>}
        </button>

      </form>
    </div>
  );
}
