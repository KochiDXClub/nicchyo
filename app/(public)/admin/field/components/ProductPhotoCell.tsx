"use client";

/**
 * 現場登録の「売っているもの」1行ぶんの写真ボタン（小さな正方形）。タップで写真を撮る・選ぶ。
 * 写真を置けるのは、保存済みの商品で、店舗の写真の使用許可を記録済みのときだけ（disabledReason に理由を渡す）。
 * 写真を外す×印は許可の有無によらず出す（許可を取り下げた店舗の写真も外せるように）。
 */
export function ProductPhotoCell({
  name,
  imageUrl,
  busy,
  disabledReason,
  onPick,
  onRemove,
}: {
  name: string;
  imageUrl?: string;
  busy: boolean;
  /** 写真を置けない理由。あれば押せない */
  disabledReason?: string;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const label = name.trim() || "この行";
  const disabled = busy || !!disabledReason;
  return (
    <div className="relative h-12 w-12 shrink-0">
      <label
        title={disabledReason}
        className={`flex h-full w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-line bg-white text-lg text-nicchyo-ink/55 ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={`${label}の写真`} className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true">{busy ? "…" : "📷"}</span>
        )}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label={imageUrl ? `${label}の写真を変える` : `${label}の写真を選ぶ`}
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onPick(file);
          }}
        />
      </label>
      {imageUrl && !busy ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${label}の写真を外す`}
          className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-white text-xs text-nicchyo-ink/70"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
