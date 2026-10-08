"use client";

import { useEffect, useRef, useState } from "react";
import { Store } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { toStoreThumbUrl } from "@/lib/shopImages";

const SIZE_CLASS = {
  sm: "h-8 w-8",
  md: "h-14 w-14",
} as const;

/**
 * お店のアイコン。丸く切り抜いた店舗写真を出す。
 *
 * 小さい枠なので、まず軽いサムネイル（store-thumb.webp）を試す。サムネイルが無い
 * 古い店舗では元の写真、写真が無い・読めないときは店のアイコンに落とす。
 *
 * next/image は使わない。許可していないホストの URL だとエラーを投げてページごと
 * 落ちるが、店舗写真の URL でアイコン1つのためにそうなるのは割に合わない。
 * 読めなければ次の候補、最後は店のアイコンに落とすだけにする。
 */
export default function ShopIcon({
  imageUrl,
  size = "md",
  className,
}: {
  imageUrl?: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  // 試す順に並べた候補。読めなかったら次へ進み、尽きたら店のアイコン
  const candidates = imageUrl ? [...new Set([toStoreThumbUrl(imageUrl), imageUrl])] : [];
  const [failedCount, setFailedCount] = useState(0);
  const src = candidates[failedCount];
  const imgRef = useRef<HTMLImageElement>(null);

  // サーバーで描かれた画像は、読み込みの失敗が画面の組み立て（ハイドレーション）より
  // 先に起きると onError を取りこぼす。組み立て後に、すでに失敗していないかも見る
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setFailedCount((count) => count + 1);
    }
  }, [src]);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-amber-700 ring-1 ring-amber-200",
        SIZE_CLASS[size],
        className
      )}
      aria-hidden="true"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          key={src}
          src={src}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
          onError={() => setFailedCount((count) => count + 1)}
        />
      ) : (
        <Store size={size === "sm" ? 16 : 26} />
      )}
    </span>
  );
}
