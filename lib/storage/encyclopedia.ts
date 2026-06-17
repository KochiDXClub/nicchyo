"use client";

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'nicchyo-encyclopedia-unlocked';

// デモ用: 動作確認のため、常に1コレクションを解放済みとして扱う。
// 本番運用時はこの配列を空にする（#335）。
const DEMO_UNLOCKED_IDS = ['imoten'];

export function getUnlockedItemIds(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  let stored: string[] = [];
  if (raw) {
    try {
      stored = JSON.parse(raw);
    } catch {
      stored = [];
    }
  }
  return Array.from(new Set([...DEMO_UNLOCKED_IDS, ...stored]));
}

export function unlockItem(id: string): boolean {
  if (typeof window === 'undefined') return false;
  const current = getUnlockedItemIds();
  if (current.includes(id)) return false;

  const next = [...current, id];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('nicchyo-encyclopedia-updated'));
  return true;
}

export function useEncyclopedia() {
  const [unlockedIds, setUnlockedIds] = useState<string[]>(() => getUnlockedItemIds());

  const refresh = useCallback(() => {
    setUnlockedIds(getUnlockedItemIds());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('nicchyo-encyclopedia-updated', refresh);
    return () => window.removeEventListener('nicchyo-encyclopedia-updated', refresh);
  }, [refresh]);

  return { unlockedIds, refresh };
}
