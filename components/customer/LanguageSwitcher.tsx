"use client";

import { useState } from "react";
import { useLocale } from "./LocaleProvider";
import { LANG_LABEL, type Lang } from "@/lib/i18n/langs";
import { cn } from "@/lib/cn";

/** Short code shown next to the flag. */
const LANG_CODE: Record<Lang, string> = { he: "HE", en: "EN", ru: "RU" };

/**
 * Small inline SVG flags. Emoji flags are not used on purpose: Windows has no
 * flag emoji and renders them as plain letters ("IL"), which looks broken.
 */
function Flag({ lang, className }: { lang: Lang; className?: string }) {
  const cls = cn("w-5 h-3.5 shrink-0 rounded-[3px] ring-1 ring-black/10 overflow-hidden", className);
  if (lang === "he") {
    return (
      <svg viewBox="0 0 220 160" className={cls} aria-hidden>
        <rect width="220" height="160" fill="#fff" />
        <rect y="15" width="220" height="25" fill="#0038b8" />
        <rect y="120" width="220" height="25" fill="#0038b8" />
        <g fill="none" stroke="#0038b8" strokeWidth="5.5">
          <path d="M110 52 L136 97 L84 97 Z" />
          <path d="M110 108 L84 63 L136 63 Z" />
        </g>
      </svg>
    );
  }
  if (lang === "ru") {
    return (
      <svg viewBox="0 0 9 6" className={cls} aria-hidden>
        <rect width="9" height="2" fill="#fff" />
        <rect y="2" width="9" height="2" fill="#0039a6" />
        <rect y="4" width="9" height="2" fill="#d52b1e" />
      </svg>
    );
  }
  // English - United Kingdom
  return (
    <svg viewBox="0 0 60 40" className={cls} aria-hidden preserveAspectRatio="none">
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" strokeWidth="8" />
      <path d="M0 0 L60 40 M60 0 L0 40" stroke="#c8102e" strokeWidth="3" />
      <path d="M30 0 V40 M0 20 H60" stroke="#fff" strokeWidth="12" />
      <path d="M30 0 V40 M0 20 H60" stroke="#c8102e" strokeWidth="7" />
    </svg>
  );
}

/**
 * Storefront language switcher: flag + short code (HE / EN / RU). Renders
 * nothing unless the tenant enabled more than one language, so stores that
 * didn't opt in are untouched. Picking a language sets the `qf_lang` cookie and
 * refreshes so the server re-renders the menu (and chrome) in that language.
 */
export function LanguageSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { lang, enabled, setLang } = useLocale();
  const [open, setOpen] = useState(false);

  if (!enabled || enabled.length <= 1) return null;

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`שפה: ${LANG_LABEL[lang]}`}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl border border-qf-line bg-white text-qf-ink text-sm hover:bg-qf-bg"
      >
        <Flag lang={lang} />
        <span className="font-bold text-xs tracking-wide" dir="ltr">{LANG_CODE[lang]}</span>
        {!compact && <span className="font-medium hidden sm:inline">{LANG_LABEL[lang]}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* text-qf-ink is required: on mobile the switcher sits inside the
              store hero, which sets text-white - without an explicit colour the
              language names rendered white-on-white and looked like an empty box. */}
          <div className="absolute z-50 mt-1 end-0 min-w-[160px] rounded-xl border border-qf-line bg-white text-qf-ink shadow-lg overflow-hidden">
            {enabled.map((raw) => {
              const l = raw as Lang;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (l !== lang) setLang(l);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 text-start px-3.5 py-2.5 text-sm hover:bg-qf-bg",
                    l === lang && "font-bold bg-qf-soft",
                  )}
                >
                  <Flag lang={l} />
                  <span className="font-bold text-xs w-6" dir="ltr">{LANG_CODE[l]}</span>
                  <span>{LANG_LABEL[l]}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
