"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getShopBannerImage } from "@/lib/shopImages";
import { useVendorShopProfile, type FormState } from "./useVendorShopProfile";
import { ProductsSection } from "./ProductsSection";
import { HighlightSection } from "./HighlightSection";

const CATEGORIES = [
  "食材",
  "食べ物",
  "道具・工具",
  "生活雑貨",
  "植物・苗",
  "アクセサリー",
  "手作り・工芸",
];

export default function MyShopDetailPage() {
  const {
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
  } = useVendorShopProfile();

  const [editBasic, setEditBasic] = useState(false);
  const [editStall, setEditStall] = useState(false);
  const [editImages, setEditImages] = useState(false);
  const [editLinks, setEditLinks] = useState(false);

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
                    <span className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50/70 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={form.ownerNamePublic}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            ownerNamePublic: event.target.checked,
                          }))
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 accent-nicchyo-primary"
                      />
                      <span className="text-[11px] leading-relaxed text-slate-600">
                        店主名を地図・検索の公開ページに表示する
                        <br />
                        <span className="text-slate-500">
                          オフのあいだは店主名を保存していても来訪者には表示されません。
                        </span>
                      </span>
                    </span>
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
              <HighlightSection
                highlight={form.highlight}
                onHighlightChange={handleChange("highlight")}
                error={errors.highlight}
              />

              <ProductsSection
                products={products}
                productName={productName}
                onProductNameChange={setProductName}
                onRegister={handleProductRegister}
                productError={productError}
                showProductOptions={showProductOptions}
                productImageUrl={productImageUrl}
                onProductImageUrlChange={setProductImageUrl}
                productSeasons={productSeasons}
                onToggleSeason={toggleSeason}
                onConfirm={handleProductConfirm}
              />

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
