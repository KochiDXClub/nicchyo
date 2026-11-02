'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

interface MenuContextType {
  isMenuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
}

const REOPEN_KEY = 'nicchyo-reopen-menu';

/**
 * メニューの中で言語を切り替えると、ページ全体を読み込み直す。
 * そのままだとメニューが閉じてしまうので、読み込み直したあとに開き直すよう目印を残す。
 */
export function rememberMenuReopen() {
  try {
    sessionStorage.setItem(REOPEN_KEY, '1');
  } catch {
    // 保存できない環境では、メニューは閉じたまま
  }
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

export function MenuProvider({ children }: { children: ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(REOPEN_KEY)) {
        sessionStorage.removeItem(REOPEN_KEY);
        setIsMenuOpen(true);
      }
    } catch {
      // sessionStorage が使えない環境では何もしない
    }
  }, []);

  const openMenu = useCallback(() => setIsMenuOpen(true), []);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  const toggleMenu = useCallback(() => setIsMenuOpen((prev) => !prev), []);

  return (
    <MenuContext.Provider value={{ isMenuOpen, openMenu, closeMenu, toggleMenu }}>
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu() {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error('useMenu must be used within MenuProvider');
  }
  return context;
}
