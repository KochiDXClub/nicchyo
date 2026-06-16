"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { ArrowLeft, Clock, Pencil, X as XIcon } from "lucide-react";
import type { Shop } from "../data/shops";

// ─── Shared types ─────────────────────────────────────────────────────────────
export type BannerTheme = {
  bg: string;
  accent: string;
  text: string;
  border: string;
  light: string;
};

export type ActivePostItem = {
  text: string;
  imageUrl?: string;
  expiresAt: string;
  createdAt?: string;
};

// ─── Category fallback ────────────────────────────────────────────────────────
export const CATEGORY_FALLBACK: Record<string, { emoji: string; gradient: string }> = {
  "食材":     { emoji: "🥦", gradient: "bg-gradient-to-br from-emerald-100 to-green-200" },
  "加工食品": { emoji: "🍱", gradient: "bg-gradient-to-br from-amber-100 to-orange-200" },
  "工芸品":   { emoji: "🎨", gradient: "bg-gradient-to-br from-purple-100 to-indigo-200" },
  "植物":     { emoji: "🌿", gradient: "bg-gradient-to-br from-green-100 to-emerald-200" },
  "飲食":     { emoji: "🍜", gradient: "bg-gradient-to-br from-orange-100 to-red-200" },
};

// ─── Business info card ───────────────────────────────────────────────────────
function formatBusinessHours(start?: string, end?: string) {
  const s = start?.trim();
  const e = end?.trim();
  if (s && e) return `${s} 〜 ${e}`;
  if (s) return `${s}から`;
  if (e) return `${e}まで`;
  return null;
}

export function ShopBusinessInfoCard({ shop, theme }: { shop: Shop; theme: BannerTheme }) {
  const businessHours = formatBusinessHours(shop.businessHoursStart, shop.businessHoursEnd);
  const scheduleText = shop.schedule?.trim() || "出店予定は未設定です";
  const rainPolicyLabel =
    shop.rainPolicy && shop.rainPolicy !== "undecided"
      ? shop.rainPolicy === "outdoor"
        ? "雨でも出店"
        : shop.rainPolicy === "tent"
          ? "雨でも出店（テント）"
          : "雨天中止"
      : null;

  return (
    <div
      className="rounded-2xl border p-4 shadow-sm"
      style={{ borderColor: theme.border, backgroundColor: theme.bg }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
          aria-hidden
        >
          <Clock className="h-4 w-4" style={{ color: theme.text }} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.text }}>
            営業情報
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-700">
            今日行く前に、ここだけ確認できます
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/80 bg-white px-3 py-3 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">出店予定</p>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-800">{scheduleText}</p>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white px-3 py-3 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">営業時間</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            {businessHours || "営業時間は未設定です"}
          </p>
          {rainPolicyLabel && (
            <p className="mt-1 text-xs font-medium text-slate-500">{rainPolicyLabel}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
export function ShopBannerHero({
  shop,
  bannerImage,
  theme,
  heroImageError,
  onImageError,
  mode,
  isKotodute,
  showProductPreview = false,
  onEdit,
}: {
  shop: Shop;
  bannerImage: string;
  theme: BannerTheme;
  heroImageError: boolean;
  onImageError: () => void;
  mode: "compact" | "expanded";
  isKotodute: boolean;
  showProductPreview?: boolean;
  onEdit?: () => void;
}) {
  if (mode === "compact") {
    return (
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          {heroImageError ? (
            <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xl">
              {CATEGORY_FALLBACK[shop.category ?? ""]?.emoji ?? "🏪"}
            </div>
          ) : (
            <Image
              src={bannerImage}
              alt={`${shop.name}の写真`}
              fill
              className="object-cover object-center"
              onError={onImageError}
            />
          )}
        </div>

        <div className="min-w-0 flex-1 pr-12">
          <div className="flex flex-wrap items-center gap-1">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ backgroundColor: theme.light, color: theme.text }}
            >
              {shop.category || "ショップ"}
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              今日出店中
            </span>
          </div>
          <h2 className="mt-1 line-clamp-2 text-[17px] font-extrabold leading-tight text-slate-900">
            {shop.name}
          </h2>
          {!isKotodute && shop.catchphrase && (
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{shop.catchphrase}</p>
          )}
          {showProductPreview && !isKotodute && shop.products.length > 0 && (
            <div className="mt-1.5 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {shop.products.slice(0, 4).map((product) => (
                <span
                  key={product}
                  className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-600"
                >
                  {product}
                </span>
              ))}
              {shop.products.length > 4 && (
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-400">
                  +{shop.products.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-56 overflow-hidden rounded-[28px] border border-slate-100 bg-slate-100 shadow-sm md:h-64 md:rounded-none md:border-0 md:shadow-none">
      {heroImageError ? (
        <div
          className={`flex h-full w-full items-center justify-center ${
            CATEGORY_FALLBACK[shop.category ?? ""]?.gradient ?? "bg-gradient-to-br from-slate-100 to-slate-200"
          }`}
        >
          <span className="text-7xl">{CATEGORY_FALLBACK[shop.category ?? ""]?.emoji ?? "🏪"}</span>
        </div>
      ) : (
        <Image
          src={bannerImage}
          alt={`${shop.name}の写真`}
          fill
          className="object-cover object-center"
          priority
          onError={onImageError}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/18 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur-sm">
                {shop.category || "ショップ"}
              </span>
              <span className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                今日出店中
              </span>
            </div>
            <h2 className="text-3xl font-extrabold leading-tight text-white drop-shadow-md md:text-4xl">
              {shop.name}
            </h2>
            {!isKotodute && shop.catchphrase && (
              <p className="mt-1 text-sm font-medium text-white/80 drop-shadow">
                {shop.catchphrase}
              </p>
            )}
          </div>
          {onEdit && !isKotodute && (
            <button
              type="button"
              onClick={onEdit}
              className="shrink-0 flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/30"
            >
              <Pencil className="h-3 w-3" />
              編集
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Subview header ───────────────────────────────────────────────────────────
export function ShopSubviewHeader({
  shop,
  bannerImage,
  theme,
  heroImageError,
  onImageError,
  title,
  titleIcon,
  onBack,
  onClose,
  rightSlot,
}: {
  shop: Shop;
  bannerImage: string;
  theme: BannerTheme;
  heroImageError: boolean;
  onImageError: () => void;
  title: string;
  titleIcon?: ReactNode;
  onBack: () => void;
  onClose?: () => void;
  rightSlot?: ReactNode;
}) {
  return (
    <div
      className="sticky top-0 z-10 shrink-0 border-b bg-white/95 px-3 py-3 backdrop-blur-sm"
      style={{ borderColor: theme.border }}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="pointer-events-auto flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 active:scale-95"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          戻る
        </button>

        <div className="flex flex-1 items-center justify-center gap-1.5 text-sm font-bold text-slate-900">
          {titleIcon}
          <span>{title}</span>
        </div>

        {rightSlot || onClose ? (
          <div className="flex min-w-[3.5rem] items-center justify-end gap-1.5">
            {rightSlot}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200"
                aria-label="閉じる"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="w-14" />
        )}
      </div>

      <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            {heroImageError ? (
              <div className="flex h-full w-full items-center justify-center bg-slate-100 text-base">
                {CATEGORY_FALLBACK[shop.category ?? ""]?.emoji ?? "🏪"}
              </div>
            ) : (
              <Image
                src={bannerImage}
                alt={`${shop.name}の写真`}
                fill
                className="object-cover object-center"
                onError={onImageError}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{ backgroundColor: theme.light, color: theme.text }}
              >
                {shop.category || "ショップ"}
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                今日出店中
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-sm font-bold text-slate-900">{shop.name}</p>
            {shop.catchphrase && (
              <p className="line-clamp-1 text-xs text-slate-500">{shop.catchphrase}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
