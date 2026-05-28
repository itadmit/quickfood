"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IcoChevDown, IcoPin, IcoSearch, IcoCheck } from "@/components/shared/Icons";

interface Props {
  cities: string[];
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
}

export function CitySelect({
  cities,
  value,
  onChange,
  placeholder = "בחרו עיר",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return cities;
    const k = q.toLocaleLowerCase("he-IL");
    return cities.filter((c) => c.toLocaleLowerCase("he-IL").includes(k));
  }, [cities, query]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(c: string) {
    onChange(c);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full bg-white border border-qf-line rounded-2xl px-4 h-14 text-base outline-none focus:border-(--qf-primary) focus:ring-2 focus:ring-(--qf-primary)/15 transition flex items-center justify-between gap-3"
      >
        <span className="flex items-center gap-2 min-w-0">
          <IcoPin s={16} c="var(--qf-deep)" />
          <span
            className={
              value
                ? "truncate font-medium text-black"
                : "truncate text-qf-mute font-normal"
            }
          >
            {value || placeholder}
          </span>
        </span>
        <IcoChevDown s={14} c="var(--qf-mute)" />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full mt-2 bg-white border border-qf-line rounded-2xl shadow-xl shadow-black/10 z-20 overflow-hidden animate-qf-bubble-in">
          {cities.length > 6 && (
            <div className="p-2 border-b border-qf-line-soft">
              <div className="flex items-center gap-2 bg-qf-bg/60 rounded-xl px-3 py-2">
                <IcoSearch c="currentColor" s={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="חפש עיר"
                  className="flex-1 bg-transparent outline-none text-sm font-medium text-black placeholder:text-qf-mute"
                  autoFocus
                />
              </div>
            </div>
          )}
          <ul
            role="listbox"
            className="max-h-64 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="text-center text-sm text-qf-mute py-6">
                לא מצאנו עיר תואמת
              </li>
            ) : (
              filtered.map((c) => {
                const selected = c === value;
                return (
                  <li key={c}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => pick(c)}
                      className={
                        "w-full flex items-center justify-between gap-3 px-4 py-3 text-start text-sm transition " +
                        (selected
                          ? "bg-(--qf-primary)/10 font-bold text-(--qf-deep)"
                          : "hover:bg-qf-bg/60 text-black font-medium")
                      }
                    >
                      <span className="truncate">{c}</span>
                      {selected && <IcoCheck c="var(--qf-deep)" s={14} />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
