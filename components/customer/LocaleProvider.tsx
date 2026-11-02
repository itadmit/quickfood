"use client";

import { createContext, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";
import { dirFor, LANG_COOKIE, type Lang } from "@/lib/i18n/langs";
import { t as translate } from "@/lib/i18n/dictionary";

interface LocaleContextValue {
  lang: Lang;
  dir: "rtl" | "ltr";
  enabled: Lang[];
  /** Translate a UI-chrome key into the active language. */
  t: (key: string) => string;
  /** Persist the choice (cookie) and re-render the server tree in that language. */
  setLang: (lang: Lang) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Active storefront locale. Falls back to Hebrew when used outside a provider
 * so shared components rendered before opt-in never break.
 */
export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (ctx) return ctx;
  return {
    lang: "he",
    dir: "rtl",
    enabled: ["he"],
    t: (k) => translate(k, "he"),
    setLang: () => {},
  };
}

export function LocaleProvider({
  lang,
  enabled,
  children,
}: {
  lang: Lang;
  enabled: Lang[];
  children: React.ReactNode;
}) {
  const router = useRouter();

  const setLang = useCallback(
    (next: Lang) => {
      try {
        document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      } catch {
        /* cookie blocked - the switch simply won't persist */
      }
      router.refresh();
    },
    [router],
  );

  const value: LocaleContextValue = {
    lang,
    dir: dirFor(lang),
    enabled,
    t: (key) => translate(key, lang),
    setLang,
  };

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
