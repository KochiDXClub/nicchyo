"use client";

import { Fragment, useId, useState, type ReactNode, type SVGProps } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  Carrot,
  ChevronDown,
  Clock,
  CreditCard,
  Expand,
  Rotate3d,
  Gem,
  Globe,
  Heart,
  Instagram,
  Palette,
  ShoppingBasket,
  Smartphone,
  Sprout,
  Store,
  Tag,
  TrainFront,
  UserRound,
  Umbrella,
  UtensilsCrossed,
  Wallet,
  Wrench,
  X as XIcon,
  type LucideIcon,
} from "lucide-react";
import type { Shop } from "../data/shops";
import { useT } from "@/lib/i18n/LocaleContext";
import { RAIN_OPTIONS } from "@/lib/vendor/storeOptions";
import { toIsoDate } from "@/lib/market/calendar";

/**
 * 今日この店が出ているかを、割り当てられた出店日で判定する。
 *
 * 出店日が分からないときは false を返してバッジを出さない。
 * 「出ていない」と断定はせず、単に何も言わない扱いにする。
 */
function isOpenToday(shop: Shop): boolean {
  if (!shop.assignmentMarketDate) return false;
  return shop.assignmentMarketDate === toIsoDate(new Date());
}

// ─── Shared types ─────────────────────────────────────────────────────────────
export type BannerTheme = {
  bg: string;
  accent: string;
  text: string;
  border: string;
  light: string;
};

/**
 * バナーの配色。店舗の themeColor（出店者が選ぶプリセット）で決まる。
 *
 * BannerTheme を受け取る側（ShopDetailBanner・AiConsultPanel・はじめての方への
 * 案内パネル内のデモ）が同じ色を使えるよう、型と同じ場所に置く。
 */
export const BANNER_THEME_PRESETS = {
  amber:  { bg: "#FFFBEB", accent: "#F59E0B", text: "#92400E", border: "#FDE68A", light: "#FEF3C7" },
  green:  { bg: "#F0FDF4", accent: "#7ED957", text: "#166534", border: "#BBF7D0", light: "#DCFCE7" },
  orange: { bg: "#FFF7ED", accent: "#F97316", text: "#9A3412", border: "#FED7AA", light: "#FFEDD5" },
  earth:  { bg: "#FDF6EE", accent: "#B45309", text: "#7C2D12", border: "#DDB898", light: "#FEF3E2" },
  navy:   { bg: "#EFF6FF", accent: "#3B82F6", text: "#1E40AF", border: "#BFDBFE", light: "#DBEAFE" },
  rose:   { bg: "#FFF1F2", accent: "#F43F5E", text: "#9F1239", border: "#FECDD3", light: "#FFE4E6" },
} as const;

export type BannerThemeKey = keyof typeof BANNER_THEME_PRESETS;

/** 未設定・未知のキーは amber に倒す */
export function resolveBannerTheme(themeColor?: string | null): BannerTheme {
  return BANNER_THEME_PRESETS[themeColor as BannerThemeKey] ?? BANNER_THEME_PRESETS.amber;
}

export type ActivePostItem = {
  /** vendor_contents の id（ハートリアクション連携用） */
  id?: string;
  text: string;
  imageUrl?: string;
  expiresAt: string;
  createdAt?: string;
};

// ─── Category icon ────────────────────────────────────────────────────────────
// 写真が無い・読めないときの代わり。キーは categories テーブルの name
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "食べ物": UtensilsCrossed,
  "食材": Carrot,
  "植物・苗": Sprout,
  "道具・工具": Wrench,
  "生活雑貨": ShoppingBasket,
  "手作り・工芸": Palette,
  "アクセサリー": Gem,
};

export function categoryIcon(category?: string | null): LucideIcon {
  return CATEGORY_ICONS[category ?? ""] ?? Store;
}

/** 写真の代わりに、テーマの淡い色の地にカテゴリのアイコンを置く */
export function CategoryPlaceholder({
  category,
  theme,
  iconClassName,
}: {
  category?: string | null;
  theme: BannerTheme;
  iconClassName: string;
}) {
  const Icon = categoryIcon(category);
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: theme.light }}>
      <Icon className={iconClassName} style={{ color: theme.text }} strokeWidth={1.5} aria-hidden />
    </div>
  );
}

// ─── Shop info list ───────────────────────────────────────────────────────────
function formatBusinessHours(start?: string, end?: string) {
  const s = start?.trim();
  const e = end?.trim();
  if (s && e) return `${s} 〜 ${e}`;
  if (s) return `${s}から`;
  if (e) return `${e}まで`;
  return null;
}

const RAIN_POLICY_LABELS: Record<string, string> = {
  ...Object.fromEntries(RAIN_OPTIONS.map(({ key, label }) => [key, label])),
  tent: "雨でも出店（テント）",
};

const PAYMENT_METHODS: Record<string, { label: string; icon: LucideIcon }> = {
  cash: { label: "現金", icon: Banknote },
  card: { label: "カード", icon: CreditCard },
  paypay: { label: "PayPay", icon: Smartphone },
  ic: { label: "交通系IC", icon: TrainFront },
};

/** X（旧 Twitter）のロゴ。lucide には今の X のロゴが無い */
function XLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/** @ 付きや ID だけの入力も、開ける URL にする */
function socialUrl(value: string, base: string) {
  if (value.startsWith("http")) return value;
  return base ? `${base}${value.replace(/^@/, "")}` : `https://${value}`;
}

function InfoRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-nicchyo-ink/40" aria-hidden />
      <dt className="w-16 shrink-0 pt-px text-xs font-semibold text-nicchyo-ink/55">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm font-semibold leading-relaxed text-nicchyo-ink">{children}</dd>
    </div>
  );
}

/**
 * 出店時間・雨の日・出店日・支払い・出店スタイル・出店者（先頭の2つ以外は「もっと見る」で開く）と、SNS／サイトへのリンク。
 * 出店者が書いていない項目は行ごと出さない（何も書いていなければ何も出さない）
 */
/** 最初から出す行の数。残りは「もっと見る」で開く */
const PRIMARY_ROW_COUNT = 2;

export function ShopInfoList({ shop }: { shop: Shop }) {
  const t = useT();
  // 最初は2行だけを出し、ほかは「もっと見る」で開く。下の商品や AI相談まで指が届きやすいように
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  // 出店者名は個人情報なので、出店者が公開にしたときだけ届く（vendor_owner_profiles の is_public。既定は非公開）。
  // 高校の部活など団体名を出したい店のために表示は残し、空なら行ごと出さない
  const ownerName = shop.ownerName?.trim();
  const schedule = shop.schedule?.trim();
  const businessHours = formatBusinessHours(shop.businessHoursStart, shop.businessHoursEnd);
  const rainPolicy = shop.rainPolicy ? RAIN_POLICY_LABELS[shop.rainPolicy] : undefined;
  const payments = shop.paymentMethods ?? [];
  const styles = [...(shop.stallStyleTags ?? []).map(t), ...(shop.stallStyle?.trim() ? [shop.stallStyle.trim()] : [])];
  const { instagram, twitter, website } = shop.socialLinks ?? {};
  const links: { href: string; label: string; icon: ReactNode }[] = [];
  if (instagram) {
    links.push({ href: socialUrl(instagram, "https://instagram.com/"), label: "Instagram", icon: <Instagram className="h-4 w-4" aria-hidden /> });
  }
  if (twitter) {
    links.push({ href: socialUrl(twitter, "https://x.com/"), label: "X", icon: <XLogo className="h-3.5 w-3.5" /> });
  }
  if (website) {
    links.push({ href: socialUrl(website, ""), label: t("サイト"), icon: <Globe className="h-4 w-4" aria-hidden /> });
  }

  // 書かれている項目を、来訪者が知りたい順に並べる。先頭の2つを出し、残りを「もっと見る」に入れる
  // （出店時間や雨の日が無い店でも、ほかの情報が2つまで最初から見える）
  const rows: { key: string; node: ReactNode }[] = [];
  if (businessHours) rows.push({ key: "hours", node: <InfoRow icon={Clock} label={t("出店時間")}>{businessHours}</InfoRow> });
  if (rainPolicy) rows.push({ key: "rain", node: <InfoRow icon={Umbrella} label={t("雨の日")}>{t(rainPolicy)}</InfoRow> });
  if (schedule) rows.push({ key: "schedule", node: <InfoRow icon={CalendarDays} label={t("出店日")}>{t(schedule)}</InfoRow> });
  if (payments.length > 0) {
    rows.push({
      key: "payments",
      node: (
        <InfoRow icon={Wallet} label={t("支払い")}>
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            {payments.map((method) => {
              const payment = PAYMENT_METHODS[method];
              const PaymentIcon = payment?.icon;
              return (
                <span key={method} className="inline-flex items-center gap-1">
                  {PaymentIcon && <PaymentIcon className="h-3.5 w-3.5 text-nicchyo-ink/55" aria-hidden />}
                  {t(payment?.label ?? method)}
                </span>
              );
            })}
          </span>
        </InfoRow>
      ),
    });
  }
  if (styles.length > 0) rows.push({ key: "style", node: <InfoRow icon={Tag} label={t("スタイル")}>{styles.join("・")}</InfoRow> });
  if (ownerName) rows.push({ key: "owner", node: <InfoRow icon={UserRound} label={t("出店者")}>{ownerName}</InfoRow> });

  const primaryRows = rows.slice(0, PRIMARY_ROW_COUNT);
  const detailRows = rows.slice(PRIMARY_ROW_COUNT);
  if (rows.length === 0 && links.length === 0) return null;

  return (
    <div className="rounded-card bg-white px-4 ring-1 ring-line">
      {primaryRows.length > 0 && (
        <dl className="divide-y divide-line">
          {primaryRows.map((row) => <Fragment key={row.key}>{row.node}</Fragment>)}
        </dl>
      )}

      {detailRows.length > 0 && (
        <>
          <dl id={detailsId} hidden={!expanded} className="divide-y divide-line border-t border-line">
            {detailRows.map((row) => <Fragment key={row.key}>{row.node}</Fragment>)}
          </dl>
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            aria-controls={detailsId}
            className="flex h-11 w-full items-center justify-center gap-1 border-t border-line text-[13px] font-semibold text-nicchyo-ink/70 transition hover:text-nicchyo-ink"
          >
            {expanded ? t("閉じる") : t("もっと見る")}
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ease-out-soft motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        </>
      )}

      {/* SNS・サイトはいつも見せる（「もっと見る」に入れない） */}
      {links.length > 0 && (
        <div className={`flex flex-wrap gap-2 py-3 ${rows.length > 0 ? "border-t border-line" : ""}`}>
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-chip bg-white px-3.5 text-[13px] font-semibold text-nicchyo-ink shadow-chip ring-1 ring-line transition hover:bg-nicchyo-ink/[0.03] active:scale-95 motion-reduce:active:scale-100"
            >
              {link.icon}
              {link.label}
            </a>
          ))}
        </div>
      )}
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
  isFavorite = false,
  onToggleFavorite,
  onOpenPhoto,
  isPanorama = false,
}: {
  shop: Shop;
  bannerImage: string;
  theme: BannerTheme;
  heroImageError: boolean;
  onImageError: () => void;
  mode: "compact" | "expanded" | "photo" | "info";
  /** その店の行が1つでもあれば点灯する（商品だけ入れた場合も点灯） */
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  /** 写真を拡大表示で開く。無ければ（出店者が写真を出していない店など）写真は押せない */
  onOpenPhoto?: () => void;
  /** 全周写真の店。バナーにはサムネイルを出し、タップするとドラッグで見渡せることを示す */
  isPanorama?: boolean;
}) {
  if (mode === "compact") {
    return (
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          {heroImageError ? (
            <CategoryPlaceholder category={shop.category} theme={theme} iconClassName="h-7 w-7" />
          ) : (
            <Image
              src={bannerImage}
              alt={`${shop.name}の写真`}
              fill
              // 枠は 64px 固定。sizes が無いと画面幅ぶんの大きさで取りに行く
              sizes="64px"
              className="object-cover object-center"
              onError={onImageError}
            />
          )}
          {onOpenPhoto && !heroImageError && (
            <button
              type="button"
              onClick={onOpenPhoto}
              aria-label={`${shop.name}の写真を大きく見る`}
              className="absolute inset-0 z-[1]"
            />
          )}
        </div>

        <div className="min-w-0 flex-1 pr-12">
          <div className="flex flex-wrap items-center gap-1">
            <span
              className="rounded-chip px-2.5 py-0.5 text-[13px] font-bold"
              style={{ backgroundColor: theme.light, color: theme.text }}
            >
              {shop.category || "ショップ"}
            </span>
            {isOpenToday(shop) && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-bold text-emerald-700">
                今日出店中
              </span>
            )}
          </div>
          <h2 className="mt-1 line-clamp-2 text-xl font-extrabold leading-tight text-slate-900">
            {shop.name}
          </h2>
          {shop.catchphrase && (
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{shop.catchphrase}</p>
          )}
        </div>
      </div>
    );
  }

  // "photo" は写真だけ、"info" は店名まわりだけ。PC のダイアログは写真を左、残りを右に分けて置く
  const photoOnly = mode === "photo";
  const photoBlock = (
    <div
      className={
        photoOnly
          ? "relative h-full w-full overflow-hidden bg-nicchyo-ink/[0.06]"
          : "relative h-72 overflow-hidden rounded-sheet bg-nicchyo-ink/[0.06] shadow-card md:h-80 md:rounded-none md:shadow-none"
      }
    >
      {heroImageError ? (
        <CategoryPlaceholder category={shop.category} theme={theme} iconClassName="h-16 w-16" />
      ) : (
        <>
          {photoOnly && (
            // 縦に細長い列で写真を切らないよう、全体を収め、余白は同じ写真のぼかしで埋める
            <Image
              src={bannerImage}
              alt=""
              aria-hidden
              fill
              sizes="64px"
              className="scale-125 object-cover object-center opacity-60 blur-2xl"
            />
          )}
          <Image
            src={bannerImage}
            alt={`${shop.name}の写真`}
            fill
            // 画面幅いっぱい（PC では最大でもバナーの幅）。sizes が無いと 1920px 幅を取りに行く
            sizes={photoOnly ? "520px" : "(max-width: 768px) 100vw, 640px"}
            className={photoOnly ? "object-contain object-center" : "object-cover object-center"}
            priority
            onError={onImageError}
          />
        </>
      )}
      {onOpenPhoto && !heroImageError && (
        <button
          type="button"
          onClick={onOpenPhoto}
          aria-label={isPanorama ? `${shop.name}の写真を360度見渡す` : `${shop.name}の写真を大きく見る`}
          className="absolute inset-0 z-[1]"
        >
          <span className="absolute left-3 top-3 flex h-8 items-center gap-1 rounded-chip bg-black/35 px-2.5 text-[11px] font-bold text-white backdrop-blur-sm">
            {isPanorama ? <Rotate3d className="h-3.5 w-3.5" aria-hidden /> : <Expand className="h-3.5 w-3.5" aria-hidden />}
            {isPanorama ? "360°" : "拡大"}
          </span>
        </button>
      )}
    </div>
  );
  if (photoOnly) return photoBlock;

  return (
    <div>
      {/* 来訪者は写真を見て行くかを決めるので、写真を大きく取る。店名などは写真に重ねず、下に出す */}
      {mode === "expanded" && photoBlock}

      <div className="flex items-start justify-between gap-3 px-1 pt-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span
              className="rounded-chip px-2.5 py-1 text-[11px] font-bold"
              style={{ backgroundColor: theme.light, color: theme.text }}
            >
              {shop.category || "ショップ"}
            </span>
            {isOpenToday(shop) && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                今日出店中
              </span>
            )}
          </div>
          <h2 className="text-3xl font-extrabold leading-tight text-nicchyo-ink md:text-4xl">
            {shop.name}
          </h2>
          {shop.catchphrase && (
            <p className="mt-1 text-sm font-medium text-nicchyo-ink/70">
              {shop.catchphrase}
            </p>
          )}
        </div>
        {onToggleFavorite && (
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? "お気に入りから外す" : "お気に入りに入れる"}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
              isFavorite
                ? "bg-favorite-fg text-white hover:opacity-90"
                : "bg-nicchyo-ink/[0.06] text-nicchyo-ink/70 hover:bg-nicchyo-ink/10"
            }`}
          >
            <Heart className="h-[18px] w-[18px]" fill={isFavorite ? "currentColor" : "none"} />
          </button>
        )}
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
              <CategoryPlaceholder category={shop.category} theme={theme} iconClassName="h-6 w-6" />
            ) : (
              <Image
                src={bannerImage}
                alt={`${shop.name}の写真`}
                fill
                sizes="48px"
                className="object-cover object-center"
                onError={onImageError}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className="rounded-chip px-2 py-0.5 text-[11px] font-bold"
                style={{ backgroundColor: theme.light, color: theme.text }}
              >
                {shop.category || "ショップ"}
              </span>
              {isOpenToday(shop) && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  今日出店中
                </span>
              )}
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
