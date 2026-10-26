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
import { rememberMenuReopen } from '@/lib/ui/MenuContext';
import { PHOTO_TEXT_SHADOW } from '@/lib/ui/photoText';
import { cn } from '@/lib/utils/cn';

type Props = {
  /** photo … 写真の上（白い文字）。page … クリーム地の上（濃い文字） */
  tone?: 'photo' | 'page';
  className?: string;
  /** メニューの中に置くとき true。切り替えで読み込み直したあと、メニューを開き直す */
  reopenMenu?: boolean;
};

/**
 * 表示言語の切り替え。選んだ言語は Cookie に保存し、URL は日本語が無印・英語が /en/… になる。
 * 現在の言語は <html lang>（proxy.ts が決めた値）から読む。
 * tone="photo" は写真の上（トップのヘッダー）で読める白い文字の見た目
 */
export default function LanguageSwitcher({ tone = 'page', className, reopenMenu = false }: Props) {
  const pathname = usePathname() ?? '/';
  const [current, setCurrent] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    setCurrent(toLocale(document.documentElement.lang));
  }, []);

  const select = (locale: Locale) => {
    if (locale === current) return;
    if (reopenMenu) rememberMenuReopen();
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    // ページ全体を読み込み直し、<html lang> とサーバー描画の文言を切り替える
    window.location.assign(`${localizePath(pathname, locale)}${window.location.search}${window.location.hash}`);
  };

  return (
    <div className={cn('flex items-center gap-2', className)} role="group" aria-label="Language / 言語">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          onClick={() => select(locale)}
          aria-pressed={locale === current}
          className={cn(
            'rounded-chip px-3 py-1 text-xs transition',
            tone === 'photo'
              ? locale === current
                ? 'bg-white/90 font-semibold text-nicchyo-ink'
                : `border border-white/70 text-white ${PHOTO_TEXT_SHADOW} hover:bg-white/15`
              : locale === current
                ? 'bg-nicchyo-primary font-semibold text-nicchyo-ink'
                : 'border border-nicchyo-ink/20 text-nicchyo-ink/70 hover:bg-nicchyo-ink/5'
          )}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
