"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";

type ItemRow = {
  id: string;
  category_id: string | null;
  name_he: string;
  name_tr: string;
  name_manual: boolean;
  desc_he: string;
  desc_tr: string;
  desc_manual: boolean;
};
type CatRow = { id: string; name_he: string; name_tr: string; name_manual: boolean };

const LANGS: Array<{ code: "en" | "ru"; label: string }> = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
];

/**
 * Manual menu-translation editor. Lists every category + item with its Hebrew
 * source and an editable translation (pre-filled with the auto result). Saving
 * stores a manual override that always wins and is never re-translated. Blank =
 * revert to auto. Only rendered when the store enabled a non-Hebrew language.
 */
export function ManualTranslations({ enabled }: { enabled: string[] }) {
  const extra = useMemo(() => LANGS.filter((l) => enabled.includes(l.code)), [enabled]);
  const [lang, setLang] = useState<"en" | "ru">(extra[0]?.code ?? "en");
  const [loading, setLoading] = useState(false);
  const [cats, setCats] = useState<CatRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [orig, setOrig] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (l: "en" | "ru") => {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/v1/merchant/menu/translations?lang=${l}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setCats(d.categories);
      setItems(d.items);
      const o: Record<string, string> = {};
      for (const c of d.categories as CatRow[]) o[`menu_category:${c.id}:name`] = c.name_tr;
      for (const it of d.items as ItemRow[]) {
        o[`menu_item:${it.id}:name`] = it.name_tr;
        o[`menu_item:${it.id}:description`] = it.desc_tr;
      }
      setOrig(o);
      setEdits({ ...o });
    } catch {
      setError("טעינת התרגומים נכשלה");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (extra.length) load(lang);
  }, [lang, extra.length, load]);

  if (extra.length === 0) return null;

  const setVal = (key: string, v: string) => {
    setEdits((p) => ({ ...p, [key]: v }));
    setSaved(false);
  };
  const dirtyKeys = Object.keys(edits).filter((k) => (edits[k] ?? "") !== (orig[k] ?? ""));

  async function save() {
    if (!dirtyKeys.length || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const entries = dirtyKeys.map((k) => {
      const first = k.indexOf(":");
      const last = k.lastIndexOf(":");
      return {
        entity_type: k.slice(0, first),
        entity_id: k.slice(first + 1, last),
        field: k.slice(last + 1),
        text: edits[k] ?? "",
      };
    });
    try {
      const res = await fetch("/api/v1/merchant/menu/translations", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lang, entries }),
      });
      if (!res.ok) throw new Error();
      setOrig({ ...edits });
      setSaved(true);
    } catch {
      setError("השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  const q = filter.trim();
  const shownItems = q
    ? items.filter((it) => it.name_he.includes(q) || it.name_tr.includes(q) || (edits[`menu_item:${it.id}:name`] ?? "").includes(q))
    : items;

  const trInput = (key: string, placeholder: string, manual: boolean) => (
    <input
      dir="auto"
      value={edits[key] ?? ""}
      onChange={(e) => setVal(key, e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full h-10 px-3 rounded-lg border text-sm text-start outline-none transition",
        manual ? "border-qf-green/50 bg-qf-green-soft/30" : "border-black/15 focus:border-black",
      )}
    />
  );

  return (
    <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-6">
      <header className="mb-4">
        <h2 className="text-lg font-bold">תרגום ידני של התפריט</h2>
        <p className="text-sm text-qf-mute mt-1 leading-relaxed">
          התרגום האוטומטי מופיע ממולא מראש — אפשר לתקן ידנית כל שם ותיאור. תיקון
          ידני גובר תמיד על האוטומטי ולא יידרס. שדה ריק חוזר לתרגום האוטומטי.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="inline-flex rounded-xl border-2 border-black/15 overflow-hidden">
          {extra.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLang(l.code)}
              style={lang === l.code ? { backgroundColor: "#F8CB1E", color: "#000" } : undefined}
              className={cn("px-4 h-9 text-sm font-bold transition", lang !== l.code && "text-qf-ink2 hover:bg-qf-bg")}
            >
              {l.label}
            </button>
          ))}
        </div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="חיפוש מנה..."
          className="h-9 px-3 rounded-lg border border-black/15 text-sm outline-none focus:border-black flex-1 min-w-40"
        />
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-qf-mute">טוען...</div>
      ) : (
        <div className="space-y-5 max-h-[32rem] overflow-y-auto pe-1">
          {cats.length > 0 && !q && (
            <div>
              <h3 className="text-xs font-bold text-qf-mute mb-2">קטגוריות</h3>
              <div className="space-y-2">
                {cats.map((c) => {
                  const key = `menu_category:${c.id}:name`;
                  return (
                    <div key={c.id} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                      <div className="text-sm font-medium text-qf-ink truncate" dir="rtl">{c.name_he}</div>
                      {trInput(key, c.name_he, (edits[key] ?? "") !== "" && c.name_manual)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            {!q && <h3 className="text-xs font-bold text-qf-mute mb-2">מנות</h3>}
            <div className="space-y-4">
              {shownItems.map((it) => {
                const nk = `menu_item:${it.id}:name`;
                const dk = `menu_item:${it.id}:description`;
                return (
                  <div key={it.id} className="rounded-xl border border-qf-line p-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                      <div className="text-sm font-bold text-qf-ink truncate" dir="rtl">{it.name_he}</div>
                      {trInput(nk, it.name_he, it.name_manual)}
                    </div>
                    {it.desc_he && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="text-xs text-qf-ink2 leading-snug" dir="rtl">{it.desc_he}</div>
                        <textarea
                          dir="auto"
                          value={edits[dk] ?? ""}
                          onChange={(e) => setVal(dk, e.target.value)}
                          placeholder={it.desc_he}
                          rows={2}
                          className={cn(
                            "w-full px-3 py-2 rounded-lg border text-sm text-start outline-none transition resize-y",
                            it.desc_manual ? "border-qf-green/50 bg-qf-green-soft/30" : "border-black/15 focus:border-black",
                          )}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {shownItems.length === 0 && (
                <div className="py-6 text-center text-sm text-qf-mute">אין מנות תואמות</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-qf-line">
        <button
          type="button"
          onClick={save}
          disabled={saving || dirtyKeys.length === 0}
          style={
            saving || dirtyKeys.length === 0
              ? { backgroundColor: "#eee", color: "#999", borderColor: "rgba(0,0,0,0.15)" }
              : { backgroundColor: "#F8CB1E", color: "#000", borderColor: "#000", boxShadow: "0 3px 0 #000" }
          }
          className={cn("h-11 px-6 rounded-xl border-2 font-bold text-sm transition", saving && "opacity-70 cursor-wait")}
        >
          {saving ? "שומר..." : dirtyKeys.length > 0 ? `שמירת ${dirtyKeys.length} שינויים` : "שמירה"}
        </button>
        {saved && <span className="text-sm font-bold text-qf-green">נשמר</span>}
        {error && <span className="text-sm font-medium text-qf-tomato">{error}</span>}
      </div>
    </section>
  );
}
