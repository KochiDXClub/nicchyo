"use client";

import type { CSSProperties, ReactNode } from "react";

export interface ConsultSheetProps {
  /** 裏側の暗幕をタップして閉じる */
  onClose: () => void;
  /** 暗幕の色。既定は bg-black/30 */
  backdropClassName?: string;
  /** シート本体に足すクラス（角丸・背景は共通で持つので、余白・影・最大高さなど差分だけ渡す） */
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * 相談ページで使う、画面下端から出てくるシートの共通の器。
 *
 * 「暗幕＋画面下端に張り付く角丸カード」という骨組みが、音声確認・
 * これまでの相談（モバイル）の複数箇所に別々に書かれていた（fixed inset-0 z-40 ...
 * rounded-t-3xl bg-white という同じマークアップの重複）。見た目・挙動は
 * 変えず、ここに1本化しただけ。中身とパディング・最大高さなどの
 * 見た目の差分だけを呼び出し側から渡す。
 *
 * 話し手を選ぶシート（isSpeakerPickerOpen）は、画面中央寄りに浮く
 * カード型で骨組みそのものが違うため、ここには含めていない。
 */
export default function ConsultSheet({
  onClose,
  backdropClassName = "bg-black/30",
  className = "",
  style,
  children,
}: ConsultSheetProps) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div
        className={`absolute inset-0 ${backdropClassName}`}
        onClick={onClose}
        aria-hidden="true"
      />
      {/*
        呼び出し側は md:max-w-md のような幅の上限しか渡してこない前提。
        器（この親の flex flex-col justify-end）は横方向を中央寄せしないので、
        mx-auto w-full をここで常に持たせておかないと、上限だけ効いて
        画面左端に寄ってしまう（PC で幅が狭くならない限り気づかない）
      */}
      <div className={`relative mx-auto w-full rounded-t-3xl bg-white ${className}`} style={style}>
        {children}
      </div>
    </div>
  );
}
