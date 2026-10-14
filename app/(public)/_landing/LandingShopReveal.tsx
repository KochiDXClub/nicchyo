"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { ShopBannerHero, ShopInfoList, resolveBannerTheme } from "../map/components/ShopBannerHero";
import { getShopPreviewImage } from "@/lib/shopImages";
import { cn } from "@/lib/utils/cn";
import type { Shop } from "../map/data/shops";

/** 写真が見えてから情報が開きはじめるまで。写真を一度見てもらってから開く */
const OPEN_DELAY_MS = 300;
/** 情報の行を順に出す間隔 */
const ROW_STAGGER_MS = 140;

/**
 * 「お店の紹介」の実演。本番のバナー（ShopDetailBanner）と同じ部品で、1店の写真を見せ、
 * 画面に入ったら下へ情報が開いていく。地図で店をタップしたときに何が手に入るかを、動きで見せる。
 *
 * 写真・見出し・お店の情報は本番の部品（ShopBannerHero / ShopInfoList）を呼ぶ。
 * ShopDetailBanner そのものを使わないのは、開くと閲覧数を数えたり body にクラスを付けたりと、
 * ここで起こってほしくないことが走るため（はじめての方への案内の IntroShopSheet と同じ理由）。
 *
 * 動きを減らす設定のときも開くタイミングは同じで、動かさずに切り替える。
 * IntersectionObserver が無いときは最初から開いておく
 */
export default function LandingShopReveal({ shop }: { shop: Shop }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const theme = resolveBannerTheme(shop.themeColor);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof IntersectionObserver === "undefined") {
      setOpen(true);
      return;
    }
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        timer = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
      },
      // 写真が画面の中央あたり（上下 40% を除いた帯）まで来てから開く。
      // 画面に入った直後に開くと、読む前に開ききってしまう
      { rootMargin: "-40% 0px -40% 0px" }
    );
    observer.observe(frame);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  // 閉じている間は中の「もっと見る」などを押せない・読ませない。
  // React 18 は inert 属性を描かないので、DOM に直接付ける
  useEffect(() => {
    if (detailsRef.current) detailsRef.current.inert = !open;
  }, [open]);

  const replay = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  }, []);

  const strength = shop.shopStrength?.trim();
  const rows: { key: string; node: ReactNode }[] = [
    { key: "info", node: <ShopInfoList shop={shop} /> },
  ];
  if (shop.products.length > 0) {
    rows.push({
      key: "products",
      node: (
        <div>
          <h3 className="text-[15px] font-bold text-nicchyo-ink">商品</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {shop.products.slice(0, 8).map((product) => (
              <li
                key={product}
                className="rounded-chip bg-nicchyo-base px-3 py-1.5 text-[13px] font-semibold text-nicchyo-ink/80 ring-1 ring-line"
              >
                {product}
                {shop.productPrices?.[product] != null && (
                  <span className="ml-1.5 font-normal text-nicchyo-ink/55">{shop.productPrices[product]}円</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ),
    });
  }
  if (strength) {
    rows.push({
      key: "strength",
      node: (
        <div>
          <h3 className="text-[15px] font-bold text-nicchyo-ink">お店のこだわり</h3>
          <p
            className="mt-3 rounded-card border px-4 py-3 text-sm font-semibold leading-relaxed text-nicchyo-ink"
            style={{ borderColor: theme.border, backgroundColor: theme.bg }}
          >
            {strength}
          </p>
        </div>
      ),
    });
  }

  return (
    <div>
      <div
        ref={frameRef}
        className="mx-auto max-w-[24rem] overflow-hidden rounded-sheet bg-white shadow-float ring-1 ring-line"
      >
        {/* 本番のシートと同じ取っ手 */}
        <div className="flex justify-center pt-2">
          <span aria-hidden className="h-1.5 w-10 rounded-chip bg-nicchyo-ink/15" />
        </div>
        <div className="px-4 pt-3">
          {/* 広い画面では本番のバナーが角を落とすので、ここで丸め直す */}
          <div className="overflow-hidden rounded-sheet">
            <ShopBannerHero
              shop={shop}
              bannerImage={getShopPreviewImage(shop)}
              theme={theme}
              heroImageError={imageError}
              onImageError={() => setImageError(true)}
              mode="expanded"
            />
          </div>
        </div>

        {/* 高さ 0 → 中身の高さへ開く。閉じている間は中を押せない・読ませない */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-700 ease-out-soft motion-reduce:transition-none",
            open ? "[grid-template-rows:1fr]" : "[grid-template-rows:0fr]"
          )}
          ref={detailsRef}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-6 px-5 pb-6 pt-5">
              {rows.map((row, index) => (
                <div
                  key={row.key}
                  className={cn(
                    "transition duration-500 ease-out-soft motion-reduce:transition-none",
                    open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                  )}
                  style={{ transitionDelay: open ? `${200 + index * ROW_STAGGER_MS}ms` : "0ms" }}
                >
                  {row.node}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={replay}
          disabled={!open}
          className="inline-flex h-9 items-center gap-1.5 rounded-chip px-3 text-xs font-bold text-nicchyo-ink/70 transition hover:bg-nicchyo-ink/[0.06] disabled:opacity-0"
        >
          <RotateCcw aria-hidden className="h-3.5 w-3.5" />
          もう一度ひらく
        </button>
      </div>
    </div>
  );
}
