"use client";

import { useRef, type ChangeEvent } from "react";
import { Camera, Images } from "lucide-react";

type Props = {
  onPick: (file: File) => void;
};

/**
 * 投稿の入口。まず写真を1枚決める（ストーリーと同じく、写真が主役）。
 * 投稿履歴と同じページの先頭に置くので、履歴が画面の外に押し出されない高さにしている。
 * スマホでは「撮る」でそのままカメラが開き、「選ぶ」で写真の一覧が開く。
 */
export default function PhotoPicker({ onPick }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // 同じ写真を選び直しても change が起きるように空にしておく
    e.target.value = "";
    if (file) onPick(file);
  }

  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-base font-bold text-nicchyo-ink">今日のお店を、写真1枚で</p>
      <p className="mt-1 text-sm text-nicchyo-ink/70">近況とマップのお店に出ます</p>

      <div className="mt-4 grid w-full grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-card py-6 bg-amber-500 text-white shadow-pop transition active:scale-95 motion-reduce:active:scale-100"
        >
          <Camera size={32} strokeWidth={1.8} aria-hidden="true" />
          <span className="text-lg font-bold">撮る</span>
        </button>
        <button
          type="button"
          onClick={() => libraryRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-card py-6 bg-white text-amber-700 shadow-card ring-1 ring-amber-200 transition active:scale-95 motion-reduce:active:scale-100"
        >
          <Images size={32} strokeWidth={1.8} aria-hidden="true" />
          <span className="text-lg font-bold">写真を選ぶ</span>
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
        aria-label="カメラで撮る"
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={handleChange}
        aria-label="写真を選ぶ"
      />
    </div>
  );
}
