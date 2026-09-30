"use client";

import Image from "next/image";
import { Camera } from "lucide-react";
import { Badge } from "@/components/ui";
import type { VendorAskSnapshot } from "@/lib/vendor/askQuestions";

/**
 * 屋台のひさし。日曜市の屋台のように、縞の布の下にお店の名刺を置くための飾り。
 * 幅は画面に合わせて伸ばすので、縦横比は固定しない（波の縁が少し横に伸びる）。
 */
function Awning() {
  const stripes = 10;
  const width = 32;
  return (
    <svg
      viewBox={`0 0 ${stripes * width} 44`}
      preserveAspectRatio="none"
      className="block h-11 w-full drop-shadow-sm"
      aria-hidden="true"
    >
      {Array.from({ length: stripes }, (_, i) => {
        const fill = i % 2 === 0 ? "fill-amber-500" : "fill-amber-100";
        return (
          <g key={i} className={fill}>
            <rect x={i * width} y={0} width={width} height={28} />
            {/* 縁の丸み */}
            <path d={`M${i * width} 28 a${width / 2} 14 0 0 0 ${width} 0 z`} />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * お店の名刺。ひさしの下に、来訪者に見える形でお店の顔を並べる。
 * 写真はそのまま「写真を変える」ボタンになる（タップで質問が開く）。
 */
export default function StallHero({
  snapshot,
  onEditPhoto,
  onEditName,
}: {
  snapshot: VendorAskSnapshot;
  onEditPhoto: () => void;
  onEditName: () => void;
}) {
  const name = snapshot.shopName?.trim();

  return (
    <div className="relative">
      <Awning />
      <div className="-mt-1 overflow-hidden rounded-b-card bg-white shadow-lift ring-1 ring-line">
        <button
          type="button"
          onClick={onEditPhoto}
          aria-label={snapshot.shopImageUrl ? "お店の写真を変える" : "お店の写真を入れる"}
          className="relative block h-44 w-full bg-amber-50 sm:h-56"
        >
          {snapshot.shopImageUrl ? (
            <Image
              src={snapshot.shopImageUrl}
              alt=""
              fill
              sizes="(min-width: 640px) 38rem, 100vw"
              className="object-cover"
              priority
            />
          ) : (
            <span className="flex h-full flex-col items-center justify-center gap-1.5 text-amber-700">
              <Camera size={30} aria-hidden="true" />
              <span className="text-sm font-semibold">お店の写真を入れてや</span>
            </span>
          )}
          {snapshot.shopImageUrl && (
            <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-chip bg-nicchyo-ink/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
              <Camera size={14} aria-hidden="true" />
              変える
            </span>
          )}
        </button>

        <div className="flex flex-col gap-2 px-5 pb-5 pt-4">
          <button type="button" onClick={onEditName} className="text-left" aria-label="お店の名前を変える">
            <h1
              className={
                name
                  ? "font-display text-2xl leading-tight text-nicchyo-ink"
                  : "font-display text-2xl leading-tight text-nicchyo-ink/40"
              }
            >
              {name || "お店の名前を決めてや"}
            </h1>
          </button>
          {(snapshot.categoryName || snapshot.styleTags.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {snapshot.categoryName && <Badge variant="amber">{snapshot.categoryName}</Badge>}
              {snapshot.styleTags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          )}
          {snapshot.style?.trim() && (
            <p className="text-sm leading-relaxed text-nicchyo-ink/70">{snapshot.style.trim()}</p>
          )}
        </div>
      </div>
    </div>
  );
}
