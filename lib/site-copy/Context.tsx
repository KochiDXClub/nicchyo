"use client";
import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_SITE_COPY, type SiteCopy } from "./content";

/**
 * 画面の短い文言だけをクライアントへ渡す。FAQ の全文は FAQ ページのサーバー側で読んで渡すので、
 * ルートレイアウトの HTML に全ページ分の FAQ が埋め込まれない。
 */
export type SiteTexts = SiteCopy["texts"];

const Context = createContext<SiteTexts>(DEFAULT_SITE_COPY.texts);

export function SiteCopyProvider({ initial, children }: { initial: SiteTexts; children: ReactNode }) {
  return <Context.Provider value={initial}>{children}</Context.Provider>;
}

export function useSiteTexts() {
  return useContext(Context);
}
