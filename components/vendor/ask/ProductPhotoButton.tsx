"use client";

import { useRef } from "react";
import Image from "next/image";
import { Camera, X } from "lucide-react";
import { canDecodeImage, IMAGE_DECODE_ERROR_MESSAGE } from "@/lib/image/clientCompression";

/**
 * 商品1つぶんの写真ボタン（小さな正方形）。タップで写真を選び、選んだ写真はそのままプレビューになる。
 * プレビューの URL は呼び出し側が持つ（行を足したあとも出し続けるため、ここでは片付けない）。
 */
export default function ProductPhotoButton({
  preview,
  label,
  onPick,
  onClear,
  onError,
}: {
  preview: string | null;
  /** 商品名など。読み上げ用 */
  label: string;
  onPick: (file: File) => void;
  /** 写真を外す。preview があるときだけ ×印を出す */
  onClear?: () => void;
  onError: (message: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    // 保存時の変換でつまずく前に、このブラウザで読める写真かを確かめる
    if (!(await canDecodeImage(file))) {
      onError(IMAGE_DECODE_ERROR_MESSAGE);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    onError(null);
    onPick(file);
    // 同じ写真を選び直しても change が起きるように
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="relative h-12 w-12 shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={preview ? `${label}の写真を変える` : `${label}の写真を選ぶ`}
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-btn bg-nicchyo-base text-nicchyo-ink/55 ring-1 ring-line"
      >
        {preview ? (
          <Image
            src={preview}
            alt=""
            fill
            sizes="48px"
            unoptimized={preview.startsWith("blob:")}
            className="object-cover"
          />
        ) : (
          <Camera size={20} aria-hidden="true" />
        )}
      </button>
      {preview && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`${label}の写真を外す`}
          className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-nicchyo-ink/70 shadow-card ring-1 ring-line"
        >
          <X size={12} aria-hidden="true" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        onChange={(event) => void pick(event.target.files?.[0])}
        className="hidden"
      />
    </div>
  );
}
