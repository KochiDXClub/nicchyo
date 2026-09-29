"use client";

import NextImage from "next/image";

/**
 * 出店者本人が地図を開いたとき、自分の店のバナーを開くか尋ねる案内。
 * 1端末につき1回だけ出す（呼び出し側が localStorage で管理）。
 */
export function VendorShopPrompt({
  shopName,
  shopImage,
  onOpen,
  onDismiss,
}: {
  shopName: string;
  shopImage: string | null;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="absolute left-4 right-4 top-1/2 z-[1300] -translate-y-1/2">
      <div className="rounded-2xl border border-amber-200 bg-white/95 p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
              出店者向け
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {shopName} のショップバナーを開きますか？
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="h-8 w-8 rounded-full border border-amber-200 bg-white text-xs font-bold text-amber-700 shadow-sm hover:bg-amber-50"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        {shopImage && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-amber-100 bg-white">
            <NextImage
              src={shopImage}
              alt={`${shopName}の写真`}
              width={600}
              height={160}
              className="h-40 w-full object-cover object-center"
            />
          </div>
        )}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={onOpen}
            className="w-full rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-200/70 transition hover:bg-amber-500"
          >
            お店の情報を開く
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50"
          >
            後で
          </button>
        </div>
      </div>
    </div>
  );
}
