import { useState } from "react";
import { SEASON_OPTIONS, type ProductItem, type SeasonKey } from "./useVendorShopProfile";

const requiredMark = <span className="ml-1 text-[11px] font-semibold text-rose-600">*</span>;

export function ProductsSection({
  products,
  productName,
  onProductNameChange,
  onRegister,
  productError,
  showProductOptions,
  productImageUrl,
  onProductImageUrlChange,
  productSeasons,
  onToggleSeason,
  onConfirm,
}: {
  products: ProductItem[];
  productName: string;
  onProductNameChange: (value: string) => void;
  onRegister: () => void;
  productError: string;
  showProductOptions: boolean;
  productImageUrl: string;
  onProductImageUrlChange: (value: string) => void;
  productSeasons: Set<SeasonKey>;
  onToggleSeason: (key: SeasonKey) => void;
  onConfirm: () => void;
}) {
  const [editProducts, setEditProducts] = useState(false);
  return (
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
                onChange={(event) => onProductNameChange(event.target.value)}
                placeholder="例: トマト"
                className="mt-1 w-full rounded-xl border border-orange-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-amber-400 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={onRegister}
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
                    onChange={(event) => onProductImageUrlChange(event.target.value)}
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
                        onClick={() => onToggleSeason(option.key)}
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
                  onClick={onConfirm}
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
  );
}
