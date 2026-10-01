"use client";

import { useEffect, useRef, useState } from "react";
import { canDecodeImage, IMAGE_DECODE_ERROR_MESSAGE } from "@/lib/image/clientCompression";

/**
 * 写真を1枚選ぶ入力欄の状態。選んだ写真のプレビュー、読めない写真の検出、
 * プレビュー用 URL の片付けまでを持つ。
 */
export function usePhotoPicker(initialUrl?: string) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    },
    []
  );

  const pick = async (selected: File | undefined) => {
    if (!selected) return;
    // 保存時の変換でつまずく前に、このブラウザで読める写真かを確かめる
    if (!(await canDecodeImage(selected))) {
      setError(IMAGE_DECODE_ERROR_MESSAGE);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setError(null);
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = URL.createObjectURL(selected);
    setFile(selected);
    setPreview(blobUrlRef.current);
  };

  return { file, preview, error, inputRef, pick };
}
