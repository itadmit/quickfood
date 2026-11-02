/** Shared, client-safe language primitives (no server imports). */

export type Lang = "he" | "en" | "ru";

export const SUPPORTED_LANGS: Lang[] = ["he", "en", "ru"];
export const DEFAULT_LANG: Lang = "he";

/** Cookie that stores the visitor's chosen storefront language. */
export const LANG_COOKIE = "qf_lang";

export function isLang(x: unknown): x is Lang {
  return x === "he" || x === "en" || x === "ru";
}

/** Text direction for a language. Hebrew is RTL; en/ru are LTR. */
export function dirFor(lang: Lang): "rtl" | "ltr" {
  return lang === "he" ? "rtl" : "ltr";
}

/** Native label for the language, shown in the switcher. */
export const LANG_LABEL: Record<Lang, string> = {
  he: "עברית",
  en: "English",
  ru: "Русский",
};

/**
 * Resolve the effective language for a storefront: the requested code if the
 * tenant enabled it, else Hebrew. `enabled` always implicitly contains "he".
 */
export function resolveLang(requested: string | undefined | null, enabled: string[]): Lang {
  if (isLang(requested) && (requested === "he" || enabled.includes(requested))) {
    return requested;
  }
  return DEFAULT_LANG;
}
