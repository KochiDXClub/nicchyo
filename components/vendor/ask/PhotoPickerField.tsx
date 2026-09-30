"use client";

import Image from "next/image";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { usePhotoPicker } from "./usePhotoPicker";

/**
 * 写真を選ぶ枠。タップで写真を選び、選んだ写真はそのままプレビューになる。
 * 状態は usePhotoPicker が持つので、呼び出し側はその戻り値をそのまま渡す。
 */
export default function PhotoPickerField({
  picker,
  alt,
  className,
}: {
  picker: ReturnType<typeof usePhotoPicker>;
  alt: string;
  /** 枠の高さなど。既定は h-44 */
  className?: string;
}) {
  const { preview, error, inputRef, pick } = picker;
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={preview ? "写真を変える" : "写真を選ぶ"}
        className={cn(
          "relative flex h-44 w-full items-center justify-center overflow-hidden rounded-card bg-nicchyo-base text-nicchyo-ink/55 ring-1 ring-line",
          className
        )}
      >
        {preview ? (
          <Image
            src={preview}
            alt={alt}
            fill
            sizes="(min-width: 640px) 32rem, 100vw"
            unoptimized={preview.startsWith("blob:")}
            className="object-cover"
          />
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-sm font-semibold">
            <Camera size={28} aria-hidden="true" />
            写真を撮る・選ぶ
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        onChange={(event) => void pick(event.target.files?.[0])}
        className="hidden"
      />
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </>
  );
}
