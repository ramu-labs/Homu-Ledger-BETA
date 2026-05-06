"use client";

import { createContext, useContext } from "react";
import { getT, type Lang, type TKey } from "./dictionaries";

const LanguageContext = createContext<Lang>("en");

export function LanguageProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  return <LanguageContext.Provider value={lang}>{children}</LanguageContext.Provider>;
}

/** Hook for client components — returns t() that translates a key. */
export function useT() {
  const lang = useContext(LanguageContext);
  return getT(lang);
}

/** Hook to read the current language code. */
export function useLang(): Lang {
  return useContext(LanguageContext);
}

export type { Lang, TKey };
