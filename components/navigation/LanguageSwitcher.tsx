'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_LABELS,
  localizePath,
  toLocale,
  type Locale,
} from '@/lib/i18n/config';

/**
 * 表示言語の切り替え。選んだ言語は Cookie に保存し、URL は日本語が無印・英語が /en/… になる。
 * 現在の言語は <html lang>（proxy.ts が決めた値）から読む
 */
export default function LanguageSwitcher() {
  const pathname = usePathname() ?? '/';
  const [current, setCurrent] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    setCurrent(toLocale(document.documentElement.lang));
  }, []);

  const select = (locale: Locale) => {
    if (locale === current) return;
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    // ページ全体を読み込み直し、<html lang> とサーバー描画の文言を切り替える
    window.location.assign(`${localizePath(pathname, locale)}${window.location.search}${window.location.hash}`);
  };

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Language / 言語">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          onClick={() => select(locale)}
          aria-pressed={locale === current}
          className={`rounded-full px-3 py-1 text-xs transition ${
            locale === current
              ? 'bg-nicchyo-primary font-semibold text-nicchyo-ink'
              : 'border border-nicchyo-ink/20 text-nicchyo-ink/70 hover:bg-nicchyo-ink/5'
          }`}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
