"use client";

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'nicchyo-encyclopedia-unlocked';

export function getUnlockedItemIds(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
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
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);

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
