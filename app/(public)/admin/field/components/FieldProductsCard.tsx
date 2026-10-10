"use client";

import { Card, Field, buttonClass, inputClass } from "./fieldFormParts";
import { ProductPhotoCell } from "./ProductPhotoCell";

export type ProductRow = { name: string; price: string };

/** 現場登録の「売っているもの」。商品名・価格の入力と、保存済みの商品の写真 */
export function FieldProductsCard({
  products,
  onChange,
  savedNames,
  productImages,
  photoUseAllowed,
  busyName,
  onUploadPhoto,
  onRemovePhoto,
}: {
  products: ProductRow[];
  onChange: (products: ProductRow[]) => void;
  /** 保存済みの主な商品。写真を置けるのは、この中の商品だけ */
  savedNames: string[];
  /** 商品名 → 写真の URL */
  productImages?: Record<string, string>;
  /** 保存済みの設定で、写真の使用許可があるか */
  photoUseAllowed: boolean;
  /** 写真を保存中・外している最中の商品名 */
  busyName: string | null;
  onUploadPhoto: (name: string, file: File) => void;
  onRemovePhoto: (name: string) => void;
}) {
  return (
      <Card
        title="売っているもの"
        hint="主な商品と価格（価格は分からなければ空欄でよい）。写真は、商品を保存したあとで登録できます"
      >
        {products.map((p, i) => {
          const name = p.name.trim();
          // 写真を置けるのは、保存済みの商品で、写真の使用許可が記録済みのときだけ
          const disabledReason = !(savedNames).includes(name)
            ? "先に保存すると、写真を登録できます"
            : !photoUseAllowed
              ? "保存済みの設定で写真の許可がありません"
              : undefined;
          return (
            <div key={i} className="grid grid-cols-[3rem_1fr_6rem_auto] items-end gap-2">
              <div>
                {i === 0 ? <span className="mb-1 block text-[13px] font-medium text-nicchyo-ink/70">写真</span> : null}
                <ProductPhotoCell
                  name={p.name}
                  imageUrl={name ? productImages?.[name] : undefined}
                  busy={busyName === name && name !== ""}
                  disabledReason={disabledReason}
                  onPick={(file) => onUploadPhoto(name, file)}
                  onRemove={() => onRemovePhoto(name)}
                />
              </div>
              <Field label={i === 0 ? "商品名" : ""}>
                <input
                  value={p.name}
                  onChange={(e) => onChange(products.map((row, j) => (j === i ? { ...row, name: e.target.value } : row)))}
                  maxLength={60}
                  className={inputClass}
                />
              </Field>
              <Field label={i === 0 ? "価格(円)" : ""}>
                <input
                  value={p.price}
                  inputMode="numeric"
                  onChange={(e) => onChange(products.map((row, j) => (j === i ? { ...row, price: e.target.value } : row)))}
                  className={inputClass}
                />
              </Field>
              <button
                type="button"
                aria-label={`${p.name || "この行"}を削除`}
                onClick={() => onChange(products.filter((_, j) => j !== i))}
                className={`${buttonClass} border border-line bg-white text-nicchyo-ink/70`}
              >
                ✕
              </button>
            </div>
          );
        })}
        <button
          type="button"
          disabled={products.length >= 50}
          onClick={() => onChange([...products, { name: "", price: "" }])}
          className={`${buttonClass} w-full border border-dashed border-nicchyo-ink/40 bg-white text-nicchyo-ink/70`}
        >
          ＋ 商品を追加
        </button>
      </Card>
  );
}
