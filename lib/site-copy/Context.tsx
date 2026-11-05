"use client";
import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_SITE_COPY, type SiteCopy } from "./content";
const Context = createContext<SiteCopy>(DEFAULT_SITE_COPY);
export function SiteCopyProvider({ initial, children }: { initial: SiteCopy; children: ReactNode }) {
  return <Context.Provider value={initial}>{children}</Context.Provider>;
}
export function useSiteCopy() { return useContext(Context); }
