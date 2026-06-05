"use client";

import { useMemo, useState } from "react";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";

interface StringDef {
  section: string;
  key: string;
  defaultValue: string;
}

export function KioskStringsForm({
  defaults,
  overrides,
  sectionLabels,
}: {
  defaults: StringDef[];
  overrides: Record<string, string>;
  sectionLabels: Record<string, string>;
}) {
  // Working copy keyed by dotted key - empty string means "use default".
  // Initialized from the saved overrides; missing keys stay undefined so
  // the textarea renders as a placeholder showing the default copy.
  const [values, setValues] = useState<Record<string, string>>(overrides);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [query, setQuery] = useState("");
  function pushToast(kind: ToastKind, message: string) {
    setToast({ id: Date.now(), kind, message });
  }

  // Group keys by section so the form has natural visual breaks. Filter by
  // the search query against the default text (Hebrew) + key path - when
  // a merchant remembers a phrase but not where in the flow it lives.
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? defaults.filter(
          (d) =>
            d.defaultValue.toLowerCase().includes(q) ||
            d.key.toLowerCase().includes(q),
        )
      : defaults;
    const map = new Map<string, StringDef[]>();
    for (const d of filtered) {
      const arr = map.get(d.section) ?? [];
      arr.push(d);
      map.set(d.section, arr);
    }
    return Array.from(map.entries());
  }, [defaults, query]);

  const overrideCount = useMemo(
    () =>
      Object.entries(values).filter(([, v]) => typeof v === "string" && v.trim())
        .length,
    [values],
  );

  async function save() {
    setBusy(true);
    try {
      // Strip empty values - empty string means "use default", and we
      // don't want them sitting in the DB taking up space + bloating the
      // PATCH payload on every save.
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) {
        if (typeof v === "string" && v.trim()) clean[k] = v;
      }
      const res = await fetch("/api/v1/merchant/tenant", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kiosk_string_overrides: clean }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        pushToast("err", body?.error?.message ?? "שמירה נכשלה");
        return;
      }
      pushToast("ok", "הטקסטים נשמרו");
    } finally {
      setBusy(false);
    }
  }

  function resetAll() {
    if (overrideCount === 0) return;
    if (!confirm("לאפס את כל הטקסטים המותאמים לברירת המחדל?")) return;
    setValues({});
  }

  return (
    <>
      <div className="space-y-4">
        <div className="bg-(--qf-soft) border border-(--qf-primary)/30 rounded-2xl p-4 text-sm leading-relaxed text-(--qf-deep)">
          השאר שדה ריק = ייעשה שימוש בברירת המחדל. ערוך טקסט = הוא יחליף את
          ברירת המחדל בקיוסק שלך. הסמן <code>{"{tenantName}"}</code>,{" "}
          <code>{"{number}"}</code>, <code>{"{amount}"}</code> וכו׳ נשמר כפי
          שהוא - אם תרצי לשנות את הסדר, השאר את הסמן בטקסט החדש.
        </div>

        <div className="bg-white border border-qf-line-dash rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש טקסט או מפתח..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
            />
          </div>
          <div className="text-sm text-qf-mute">
            {overrideCount > 0
              ? `${overrideCount} טקסטים מותאמים אישית`
              : "אין שינויים"}
          </div>
          <button
            type="button"
            onClick={resetAll}
            disabled={overrideCount === 0}
            className="px-4 py-2 rounded-xl border border-qf-line-dash text-sm text-qf-ink2 hover:bg-qf-line-soft disabled:opacity-50"
          >
            איפוס הכל
          </button>
        </div>

        {grouped.length === 0 && (
          <div className="bg-white border border-qf-line-dash rounded-2xl p-8 text-center text-qf-mute">
            לא נמצאו טקסטים עבור &quot;{query}&quot;
          </div>
        )}

        {grouped.map(([section, items]) => (
          <section
            key={section}
            className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-4"
          >
            <header className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-bold text-qf-ink">
                {sectionLabels[section] ?? section}
              </h2>
              <span className="text-xs text-qf-mute tnum">
                {items.length} {items.length === 1 ? "מפתח" : "מפתחות"}
              </span>
            </header>
            <div className="space-y-3">
              {items.map((d) => {
                const value = values[d.key] ?? "";
                const hasOverride = !!value.trim();
                return (
                  <div
                    key={d.key}
                    className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-3 items-start"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-qf-ink2">
                        {d.defaultValue}
                      </div>
                      <code
                        dir="ltr"
                        className="block text-[10px] text-qf-mute font-mono"
                      >
                        {d.key}
                      </code>
                    </div>
                    <div className="relative">
                      <textarea
                        value={value}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [d.key]: e.target.value,
                          }))
                        }
                        placeholder={d.defaultValue}
                        rows={value.length > 60 || d.defaultValue.length > 60 ? 3 : 1}
                        maxLength={400}
                        className="w-full px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm resize-y"
                      />
                      {hasOverride && (
                        <button
                          type="button"
                          onClick={() =>
                            setValues((prev) => {
                              const next = { ...prev };
                              delete next[d.key];
                              return next;
                            })
                          }
                          className="absolute top-1 inset-e-1 text-[11px] text-qf-mute hover:text-qf-tomato px-2 py-1"
                          aria-label="חזרה לברירת מחדל"
                        >
                          איפוס
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <div className="sticky bottom-4 z-10 flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="px-6 py-3 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-bold disabled:opacity-60 shadow-lg shadow-(--qf-primary)/25"
          >
            {busy ? "שומר..." : "שמירת השינויים"}
          </button>
        </div>
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
