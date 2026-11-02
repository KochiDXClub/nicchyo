'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from './config';
import { createTranslator, type Translate } from './translate';
import { siteTextFor, siteTextWithEmphasisFor, type SiteTextKey } from '@/lib/siteCopy';

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** app/layout.tsx で、proxy.ts が決めたロケールをクライアントコンポーネントへ渡す */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** 画面の文言を今のロケールに訳す関数。t("お気に入り") のように日本語の原文を渡す */
export function useT(): Translate {
  const locale = useLocale();
  return useMemo(() => createTranslator(locale), [locale]);
}

/** シートで編集する文言（siteText）の、今のロケール版。訳が無いキーは日本語の原文になる */
export function useSiteText() {
  const locale = useLocale();
  return useMemo(
    () => ({
      text: (key: SiteTextKey) => siteTextFor(key, locale),
      emphasis: (key: SiteTextKey, className?: string) => siteTextWithEmphasisFor(key, locale, className),
    }),
    [locale]
  );
}
