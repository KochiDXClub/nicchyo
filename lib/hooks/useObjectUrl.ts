"use client";

import { useEffect, useState } from "react";

/** 選んだ写真を画面に出すための blob URL。写真が変わる・画面を離れるときに片付ける */
export function useObjectUrl(file: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}
