"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { useLocale } from "./LocaleProvider";
import { LANG_LABEL, type Lang } from "@/lib/i18n/langs";
import { cn } from "@/lib/cn";

/**
 * Storefront language switcher (globe). Renders nothing unless the tenant
 * enabled more than one language, so stores that didn't opt in are untouched.
 * Picking a language sets the `qf_lang` cookie and refreshes so the server
 * re-renders the menu (and chrome) in that language.
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
        aria-label={LANG_LABEL[lang]}
        className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl border border-qf-line bg-white text-qf-ink text-sm hover:bg-qf-bg"
      >
        <Globe size={16} />
        {!compact && <span className="font-medium">{LANG_LABEL[lang]}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 end-0 min-w-[150px] rounded-xl border border-qf-line bg-white shadow-lg overflow-hidden">
            {enabled.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (l !== lang) setLang(l as Lang);
                }}
                className={cn(
                  "w-full text-start px-3.5 py-2.5 text-sm hover:bg-qf-bg",
                  l === lang && "font-bold bg-qf-soft",
                )}
              >
                {LANG_LABEL[l as Lang]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
