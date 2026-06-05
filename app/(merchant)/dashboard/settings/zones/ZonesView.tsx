"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IcoClose } from "@/components/shared/Icons";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";
import { cn } from "@/lib/cn";

interface Zone {
  id: string;
  name: string;
  radiusKm: number | null;
  cities: string[];
  deliveryFee: number;
  minEta: number;
  maxEta: number;
  active: boolean;
}

/** Split a free-text "city1, city2; city3" string into a clean array. */
function parseCities(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

export function ZonesView({ branchId, initial }: { branchId: string; initial: Zone[] }) {
  const router = useRouter();
  const [zones, setZones] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    radiusKm: 3,
    citiesRaw: "",
    deliveryFee: 14,
    minEta: 25,
    maxEta: 35,
  });
  const [busy, setBusy] = useState(false);
  /** Per-zone draft city text (only set while a row is in edit mode). */
  const [editingCitiesFor, setEditingCitiesFor] = useState<string | null>(null);
  const [citiesDraft, setCitiesDraft] = useState("");
  const [savingCities, setSavingCities] = useState(false);

  async function add() {
    if (!form.name) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/merchant/branches/${branchId}/zones`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          radius_km: form.radiusKm,
          cities: parseCities(form.citiesRaw),
          delivery_fee: form.deliveryFee,
          min_eta: form.minEta,
          max_eta: form.maxEta,
          active: true,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        pushToast("err", body?.error?.message ?? "יצירת האזור נכשלה");
        return;
      }
      const data = (await res.json()) as { zone: { id: string; name: string } };
      const newZone: Zone = {
        id: data.zone.id,
        name: form.name,
        radiusKm: form.radiusKm,
        cities: parseCities(form.citiesRaw),
        deliveryFee: form.deliveryFee,
        minEta: form.minEta,
        maxEta: form.maxEta,
        active: true,
      };
      setZones((p) =>
        [...p, newZone].sort((a, b) => a.name.localeCompare(b.name, "he-IL")),
      );
      setAdding(false);
      setForm({ name: "", radiusKm: 3, citiesRaw: "", deliveryFee: 14, minEta: 25, maxEta: 35 });
      pushToast("ok", "האזור נוצר");
      router.refresh();
    } catch {
      pushToast("err", "שגיאת רשת - בדוק חיבור ונסה שוב");
    } finally {
      setBusy(false);
    }
  }

  function startEditingCities(z: Zone) {
    setEditingCitiesFor(z.id);
    setCitiesDraft(z.cities.join(", "));
  }

  async function saveCities(zoneId: string) {
    const cities = parseCities(citiesDraft);
    setSavingCities(true);
    try {
      const res = await fetch(`/api/v1/merchant/zones/${zoneId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cities }),
      });
      if (res.ok) {
        setZones((p) => p.map((z) => (z.id === zoneId ? { ...z, cities } : z)));
        setEditingCitiesFor(null);
        setCitiesDraft("");
      }
    } finally {
      setSavingCities(false);
    }
  }

  async function toggleActive(z: Zone) {
    setZones((p) => p.map((x) => (x.id === z.id ? { ...x, active: !x.active } : x)));
    await fetch(`/api/v1/merchant/zones/${z.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !z.active }),
    });
  }

  const [pendingDelete, setPendingDelete] = useState<Zone | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  function pushToast(kind: ToastKind, message: string) {
    setToast({ id: Date.now(), kind, message });
  }

  function startDelete(z: Zone) {
    setPendingDelete(z);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setDeleting(true);
    const prev = zones;
    setZones((p) => p.filter((z) => z.id !== id));
    const res = await fetch(`/api/v1/merchant/zones/${id}`, { method: "DELETE" });
    setDeleting(false);
    setPendingDelete(null);
    if (!res.ok) {
      setZones(prev);
      const body = await res.json().catch(() => ({}));
      pushToast("err", body?.error?.message ?? "מחיקת האזור נכשלה");
      return;
    }
    pushToast("ok", "האזור נמחק");
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-qf-line-dash">
        <header className="px-4 lg:px-5 py-4 border-b border-qf-line-soft flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold">אזורים פעילים</div>
            <div className="text-xs text-qf-mute">{zones.length} מוגדרים</div>
          </div>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="px-3 py-1.5 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm"
          >
            {adding ? "ביטול" : "+ אזור חדש"}
          </button>
        </header>

        {adding && (
          <div className="px-4 lg:px-5 py-4 border-b border-qf-line-soft space-y-3 bg-qf-line-soft/40">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
              <Field label="שם">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="מרכז ת״א"
                  className="w-full px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm"
                />
              </Field>
              <Field label="רדיוס (ק״מ)">
                <input
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={form.radiusKm}
                  onChange={(e) => setForm({ ...form, radiusKm: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm tnum"
                />
              </Field>
              <Field label="דמי משלוח">
                <input
                  type="number"
                  min={0}
                  value={form.deliveryFee}
                  onChange={(e) =>
                    setForm({ ...form, deliveryFee: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm tnum"
                />
              </Field>
              <Field label="ETA מינ׳">
                <input
                  type="number"
                  min={0}
                  value={form.minEta}
                  onChange={(e) => setForm({ ...form, minEta: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm tnum"
                />
              </Field>
              <Field label="ETA מקס׳">
                <input
                  type="number"
                  min={0}
                  value={form.maxEta}
                  onChange={(e) => setForm({ ...form, maxEta: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm tnum"
                />
              </Field>
            </div>
            <Field label="ערים בכיסוי (מפרידים בפסיק)">
              <textarea
                value={form.citiesRaw}
                onChange={(e) => setForm({ ...form, citiesRaw: e.target.value })}
                rows={2}
                placeholder="תל אביב יפו, רמת גן, גבעתיים"
                className="w-full px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm resize-none"
              />
            </Field>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={add}
                disabled={!form.name || busy}
                className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm disabled:opacity-60"
              >
                {busy ? "יוצר..." : "צור אזור"}
              </button>
            </div>
          </div>
        )}

        {zones.length === 0 ? (
          <div className="px-4 lg:px-5 py-10 text-center text-sm text-qf-mute">
            אין אזורי משלוח. הוסף אזור כדי שלקוחות יוכלו להזמין עם משלוח.
          </div>
        ) : (
          <div className="divide-y divide-qf-line-soft">
            {zones.map((z) => (
              <div
                key={z.id}
                className="px-4 lg:px-5 py-3 space-y-2"
              >
                <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 items-center">
                    <div>
                      <div className="font-medium">{z.name}</div>
                      <div className="text-xs text-qf-mute tnum">
                        {z.radiusKm ? `רדיוס ${z.radiusKm} ק״מ` : "ללא רדיוס"}
                      </div>
                    </div>
                    <div className="text-sm tnum">₪{z.deliveryFee}</div>
                    <div className="text-sm text-qf-ink2 tnum">
                      {z.minEta}–{z.maxEta} דק׳
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleActive(z)}
                      className={cn(
                        "text-xs px-2 py-1 rounded-md inline-block w-fit",
                        z.active
                          ? "bg-qf-green-soft text-qf-green-deep"
                          : "bg-qf-line-soft text-qf-mute",
                      )}
                    >
                      {z.active ? "פעיל" : "מושבת"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => startDelete(z)}
                    className="w-8 h-8 rounded-lg hover:bg-qf-tomato-soft text-qf-mute hover:text-qf-tomato"
                    aria-label="הסר אזור"
                    title="הסר אזור"
                  >
                    <IcoClose s={14} />
                  </button>
                </div>

                {/* Cities - display chips, click "ערוך" to edit inline */}
                {editingCitiesFor === z.id ? (
                  <div className="space-y-2 bg-qf-line-soft/60 rounded-xl p-3 border border-qf-line-dash">
                    <label className="text-xs font-medium block text-qf-ink2">
                      ערים בכיסוי (מפרידים בפסיק)
                    </label>
                    <textarea
                      value={citiesDraft}
                      onChange={(e) => setCitiesDraft(e.target.value)}
                      rows={2}
                      placeholder="תל אביב יפו, רמת גן, גבעתיים"
                      className="w-full px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm bg-white resize-none"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCitiesFor(null);
                          setCitiesDraft("");
                        }}
                        className="px-3 py-1.5 rounded-lg text-sm text-qf-ink2 hover:bg-qf-line-soft"
                      >
                        ביטול
                      </button>
                      <button
                        type="button"
                        onClick={() => saveCities(z.id)}
                        disabled={savingCities}
                        className="px-3 py-1.5 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm disabled:opacity-60"
                      >
                        {savingCities ? "שומר..." : "שמור ערים"}
                      </button>
                    </div>
                  </div>
                ) : z.cities.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => startEditingCities(z)}
                    className="text-xs text-(--qf-deep) hover:underline"
                  >
                    + הוסף ערים לאזור הזה
                  </button>
                ) : (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {z.cities.map((c) => (
                      <span
                        key={c}
                        className="text-xs bg-qf-line-soft text-qf-ink2 px-2 py-1 rounded-md"
                      >
                        {c}
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => startEditingCities(z)}
                      className="text-xs text-(--qf-deep) hover:underline px-1"
                    >
                      ערוך
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="מחיקת אזור משלוח"
        message={
          <>
            האזור <span className="font-semibold">&quot;{pendingDelete?.name}&quot;</span> יימחק.
            לקוחות בכתובות שמכוסות רק על-ידי האזור הזה לא יוכלו לקבל משלוח עד שתגדיר אחד אחר.
          </>
        }
        confirmLabel="מחק"
        cancelLabel="ביטול"
        variant="danger"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium block">{label}</label>
      {children}
    </div>
  );
}
