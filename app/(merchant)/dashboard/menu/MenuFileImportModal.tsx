"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/shared/Modal";
import { IcoClose, IcoCheck, IcoTrash } from "@/components/shared/Icons";

type Option = { name: string; priceDelta: number };
type Group = {
  name: string;
  type: "single" | "multi";
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: Option[];
};
type Item = {
  name: string;
  description: string;
  price: number;
  categoryName: string;
  modifierGroups: Group[];
};
type Menu = { categories: string[]; items: Item[] };

type Phase = "upload" | "extracting" | "review" | "committing" | "done";

export function MenuFileImportModal({
  onClose,
  initialFile,
  autoStart,
}: {
  onClose: () => void;
  // Pre-loaded file from the signup hand-off (PDF/photo captured before the
  // store existed). With autoStart we kick off extraction immediately.
  initialFile?: File | null;
  autoStart?: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("upload");
  const [error, setError] = useState<string | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu>({ categories: [], items: [] });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [result, setResult] = useState<{
    categoriesImported: number;
    itemsImported: number;
    errors: Array<{ context: string; message: string }>;
  } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && phase !== "extracting" && phase !== "committing") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, phase]);

  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current || !autoStart || !initialFile) return;
    firedRef.current = true;
    void onFile(initialFile);
  }, [autoStart, initialFile]);

  async function onFile(file: File) {
    setError(null);
    setPhase("extracting");
    const form = new FormData();
    form.set("file", file);
    try {
      const res = await fetch("/api/v1/merchant/import/menu-file/preview", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "חילוץ התפריט נכשל");
        setPhase("upload");
        return;
      }
      setImportId(data.import_id);
      setMenu(data.menu);
      setPhase("review");
    } catch {
      setError("שגיאת רשת, נסה שוב");
      setPhase("upload");
    }
  }

  function patchItem(i: number, patch: Partial<Item>) {
    setMenu((m) => ({
      ...m,
      items: m.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    }));
  }
  function removeItem(i: number) {
    setMenu((m) => ({ ...m, items: m.items.filter((_, idx) => idx !== i) }));
    setExpanded(null);
  }
  function patchGroup(i: number, gi: number, patch: Partial<Group>) {
    setMenu((m) => ({
      ...m,
      items: m.items.map((it, idx) =>
        idx !== i
          ? it
          : { ...it, modifierGroups: it.modifierGroups.map((g, gx) => (gx === gi ? { ...g, ...patch } : g)) },
      ),
    }));
  }
  function removeGroup(i: number, gi: number) {
    setMenu((m) => ({
      ...m,
      items: m.items.map((it, idx) =>
        idx !== i ? it : { ...it, modifierGroups: it.modifierGroups.filter((_, gx) => gx !== gi) },
      ),
    }));
  }
  function patchOption(i: number, gi: number, oi: number, patch: Partial<Option>) {
    setMenu((m) => ({
      ...m,
      items: m.items.map((it, idx) =>
        idx !== i
          ? it
          : {
              ...it,
              modifierGroups: it.modifierGroups.map((g, gx) =>
                gx !== gi ? g : { ...g, options: g.options.map((o, ox) => (ox === oi ? { ...o, ...patch } : o)) },
              ),
            },
      ),
    }));
  }

  async function commitNow() {
    if (!importId) return;
    setPhase("committing");
    setError(null);
    const categories = Array.from(
      new Set([...menu.categories, ...menu.items.map((i) => i.categoryName)].filter(Boolean)),
    );
    try {
      const res = await fetch(`/api/v1/merchant/import/menu-file/${importId}/commit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categories, items: menu.items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "הייבוא נכשל");
        setPhase("review");
        return;
      }
      setResult({
        categoriesImported: data.categoriesImported ?? 0,
        itemsImported: data.itemsImported ?? 0,
        errors: data.errors ?? [],
      });
      setPhase("done");
      router.refresh();
    } catch {
      setError("שגיאת רשת, נסה שוב");
      setPhase("review");
    }
  }

  const categoryOptions = Array.from(
    new Set([...menu.categories, ...menu.items.map((i) => i.categoryName)].filter(Boolean)),
  );

  return (
    <Modal open onClose={onClose} size="3xl" ariaLabel="ייבוא תפריט מ-PDF או תמונה">
      <header className="sticky top-0 z-10 bg-white px-5 py-4 border-b border-qf-line-soft flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">ייבוא תפריט מ-PDF / תמונה</h2>
          <p className="text-xs text-qf-mute">
            {phase === "review"
              ? `זוהו ${menu.items.length} מנות · ערוך ואשר לפני שמירה`
              : "העלה תפריט והמערכת תחלץ ממנו את המנות והתוספות"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 w-8 h-8 rounded-lg hover:bg-qf-line-soft grid place-items-center text-qf-mute"
          aria-label="סגור"
        >
          <IcoClose c="currentColor" s={16} />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
        {error && (
          <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato rounded-xl px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {(phase === "upload" || phase === "extracting") && (
          <div className="text-center py-6 space-y-4">
            <p className="text-sm text-qf-ink2">
              העלה קובץ תפריט (PDF / PNG / JPG, עד 15MB). אנחנו נחלץ שמות מנות, מחירים ותוספות —
              בלי תמונות. תוכל לערוך הכל לפני השמירה.
            </p>
            {phase === "extracting" ? (
              <div className="text-qf-mute text-sm animate-pulse py-4">מחלץ את התפריט… זה לוקח כמה שניות</div>
            ) : (
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                className="block mx-auto text-sm text-qf-mute file:me-3 file:px-3.5 file:py-2 file:rounded-xl file:border-2 file:border-black file:bg-[#F8CB1E] file:text-black file:font-bold file:cursor-pointer file:shadow-[0_2px_0_#000] hover:file:bg-[#FFD843] file:transition"
              />
            )}
          </div>
        )}

        {(phase === "review" || phase === "committing") &&
          menu.items.map((it, i) => (
            <div key={i} className="border border-qf-line-dash rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_90px_140px] gap-2">
                  <input
                    value={it.name}
                    onChange={(e) => patchItem(i, { name: e.target.value })}
                    className="border border-qf-line-dash rounded-lg px-2.5 py-1.5 text-sm font-medium outline-none focus:border-(--qf-primary)"
                    placeholder="שם המנה"
                  />
                  <div className="relative">
                    <input
                      type="number"
                      value={it.price}
                      onChange={(e) => patchItem(i, { price: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full border border-qf-line-dash rounded-lg ps-6 pe-2 py-1.5 text-sm outline-none focus:border-(--qf-primary)"
                    />
                    <span className="absolute start-2 top-1/2 -translate-y-1/2 text-qf-mute text-xs">₪</span>
                  </div>
                  <select
                    value={it.categoryName}
                    onChange={(e) => patchItem(i, { categoryName: e.target.value })}
                    className="border border-qf-line-dash rounded-lg px-2 py-1.5 text-sm outline-none focus:border-(--qf-primary) bg-white"
                  >
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="shrink-0 w-8 h-8 rounded-lg hover:bg-qf-tomato-soft grid place-items-center text-qf-tomato"
                  aria-label="מחק מנה"
                >
                  <IcoTrash c="currentColor" s={15} />
                </button>
              </div>
              {it.modifierGroups.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                  className="text-xs text-(--qf-primary) font-medium"
                >
                  {expanded === i ? "הסתר" : "הצג"} {it.modifierGroups.length} קבוצות תוספות
                </button>
              )}
              {expanded === i &&
                it.modifierGroups.map((g, gi) => (
                  <div key={gi} className="bg-qf-line-soft/40 rounded-lg p-2.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        value={g.name}
                        onChange={(e) => patchGroup(i, gi, { name: e.target.value })}
                        className="flex-1 bg-white border border-qf-line-dash rounded-lg px-2 py-1 text-sm outline-none"
                      />
                      <label className="text-xs text-qf-ink2 inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={g.required}
                          onChange={(e) => patchGroup(i, gi, { required: e.target.checked })}
                        />
                        חובה
                      </label>
                      <span className="text-[10px] text-qf-mute">{g.type === "single" ? "בחירה אחת" : "מרובה"}</span>
                      <button
                        type="button"
                        onClick={() => removeGroup(i, gi)}
                        className="w-7 h-7 rounded-md hover:bg-qf-tomato-soft grid place-items-center text-qf-tomato"
                        aria-label="מחק קבוצה"
                      >
                        <IcoTrash c="currentColor" s={13} />
                      </button>
                    </div>
                    {g.options.map((o, oi) => (
                      <div key={oi} className="flex items-center gap-2 ps-2">
                        <input
                          value={o.name}
                          onChange={(e) => patchOption(i, gi, oi, { name: e.target.value })}
                          className="flex-1 bg-white border border-qf-line-dash rounded-lg px-2 py-1 text-xs outline-none"
                        />
                        <div className="relative w-24">
                          <input
                            type="number"
                            value={o.priceDelta}
                            onChange={(e) =>
                              patchOption(i, gi, oi, { priceDelta: Math.max(0, parseInt(e.target.value) || 0) })
                            }
                            className="w-full bg-white border border-qf-line-dash rounded-lg ps-5 pe-1.5 py-1 text-xs outline-none"
                          />
                          <span className="absolute start-1.5 top-1/2 -translate-y-1/2 text-qf-mute text-[10px]">+₪</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          ))}

        {phase === "done" && result && (
          <div className="bg-qf-green-soft border border-qf-green-line text-qf-green-deep rounded-xl px-4 py-4 text-sm space-y-1">
            <div className="inline-flex items-center gap-1.5 font-bold">
              <IcoCheck c="currentColor" s={16} />
              הייבוא הושלם
            </div>
            <p>
              נוספו {result.itemsImported} מנות ב-{result.categoriesImported} קטגוריות חדשות.
            </p>
            {result.errors.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-qf-tomato">{result.errors.length} שגיאות</summary>
                <ul className="text-xs mt-1 list-disc ps-5 space-y-0.5 text-qf-ink2">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>{e.message}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      <footer className="shrink-0 px-5 py-3 border-t border-qf-line-soft flex justify-end gap-2 bg-white">
        <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl border border-qf-line-dash text-sm">
          {phase === "done" ? "סגור" : "ביטול"}
        </button>
        {phase === "review" && (
          <button
            type="button"
            onClick={commitNow}
            disabled={menu.items.length === 0}
            className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
          >
            ייבא {menu.items.length} מנות
          </button>
        )}
        {phase === "committing" && (
          <button type="button" disabled className="px-4 py-2 rounded-xl bg-(--qf-primary) text-white text-sm font-medium opacity-60">
            מייבא…
          </button>
        )}
      </footer>
    </Modal>
  );
}
