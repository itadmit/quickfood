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
  minOrder: number;
  freeDeliveryAbove: number | null;
  minEta: number;
  maxEta: number;
  active: boolean;
}

interface ZoneDraft {
  name: string;
  radiusKm: number;
  citiesRaw: string;
  deliveryFee: number;
  minOrder: number;
  freeDeliveryAbove: number;
  minEta: number;
  maxEta: number;
}

const EMPTY_DRAFT: ZoneDraft = {
  name: "",
  radiusKm: 3,
  citiesRaw: "",
  deliveryFee: 14,
  minOrder: 0,
  freeDeliveryAbove: 0,
  minEta: 25,
  maxEta: 35,
};

function draftFromZone(z: Zone): ZoneDraft {
  return {
    name: z.name,
    radiusKm: z.radiusKm ?? 0,
    citiesRaw: z.cities.join(", "),
    deliveryFee: z.deliveryFee,
    minOrder: z.minOrder,
    freeDeliveryAbove: z.freeDeliveryAbove ?? 0,
    minEta: z.minEta,
    maxEta: z.maxEta,
  };
}

/** Split a free-text "city1, city2; city3" string into a clean array. */
function parseCities(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

export function ZonesView({
  branchId,
  freeDelivery,
  initial,
}: {
  branchId: string;
  freeDelivery: { minOrder: number | null; minItems: number | null };
  initial: Zone[];
}) {
  const router = useRouter();
  const [zones, setZones] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<ZoneDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);

  /** Per-zone full-edit state (name/radius/fee/eta/cities). */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ZoneDraft>(EMPTY_DRAFT);
  const [savingEdit, setSavingEdit] = useState(false);

  /** Free-delivery thresholds (0 = rule off). */
  const [fd, setFd] = useState({
    minOrder: freeDelivery.minOrder ?? 0,
    minItems: freeDelivery.minItems ?? 0,
  });
  const [savingFd, setSavingFd] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<Zone | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  function pushToast(kind: ToastKind, message: string) {
    setToast({ id: Date.now(), kind, message });
  }

  async function add() {
    if (!addForm.name) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/merchant/branches/${branchId}/zones`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: addForm.name,
          radius_km: addForm.radiusKm > 0 ? addForm.radiusKm : undefined,
          cities: parseCities(addForm.citiesRaw),
          delivery_fee: addForm.deliveryFee,
          min_order: addForm.minOrder,
          free_delivery_above: addForm.freeDeliveryAbove > 0 ? addForm.freeDeliveryAbove : null,
          min_eta: addForm.minEta,
          max_eta: addForm.maxEta,
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
        name: addForm.name,
        radiusKm: addForm.radiusKm > 0 ? addForm.radiusKm : null,
        cities: parseCities(addForm.citiesRaw),
        deliveryFee: addForm.deliveryFee,
        minOrder: addForm.minOrder,
        freeDeliveryAbove: addForm.freeDeliveryAbove > 0 ? addForm.freeDeliveryAbove : null,
        minEta: addForm.minEta,
        maxEta: addForm.maxEta,
        active: true,
      };
      setZones((p) =>
        [...p, newZone].sort((a, b) => a.name.localeCompare(b.name, "he-IL")),
      );
      setAdding(false);
      setAddForm(EMPTY_DRAFT);
      pushToast("ok", "האזור נוצר");
      router.refresh();
    } catch {
      pushToast("err", "שגיאת רשת - בדוק חיבור ונסה שוב");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(z: Zone) {
    setEditingId(z.id);
    setEditForm(draftFromZone(z));
  }

  async function saveEdit(id: string) {
    if (!editForm.name) return;
    setSavingEdit(true);
    try {
      const cities = parseCities(editForm.citiesRaw);
      const res = await fetch(`/api/v1/merchant/zones/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          radius_km: editForm.radiusKm > 0 ? editForm.radiusKm : undefined,
          cities,
          delivery_fee: editForm.deliveryFee,
          min_order: editForm.minOrder,
          free_delivery_above: editForm.freeDeliveryAbove > 0 ? editForm.freeDeliveryAbove : null,
          min_eta: editForm.minEta,
          max_eta: editForm.maxEta,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        pushToast("err", body?.error?.message ?? "עדכון האזור נכשל");
        return;
      }
      setZones((p) =>
        p
          .map((z) =>
            z.id === id
              ? {
                  ...z,
                  name: editForm.name,
                  radiusKm: editForm.radiusKm > 0 ? editForm.radiusKm : null,
                  cities,
                  deliveryFee: editForm.deliveryFee,
                  minOrder: editForm.minOrder,
                  freeDeliveryAbove: editForm.freeDeliveryAbove > 0 ? editForm.freeDeliveryAbove : null,
                  minEta: editForm.minEta,
                  maxEta: editForm.maxEta,
                }
              : z,
          )
          .sort((a, b) => a.name.localeCompare(b.name, "he-IL")),
      );
      setEditingId(null);
      pushToast("ok", "האזור עודכן");
    } catch {
      pushToast("err", "שגיאת רשת - בדוק חיבור ונסה שוב");
    } finally {
      setSavingEdit(false);
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

  async function saveFreeDelivery() {
    setSavingFd(true);
    try {
      const res = await fetch(`/api/v1/merchant/branches/${branchId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          free_delivery_min_order: fd.minOrder > 0 ? fd.minOrder : null,
          free_delivery_min_items: fd.minItems > 0 ? fd.minItems : null,
        }),
      });
      pushToast(res.ok ? "ok" : "err", res.ok ? "נשמר" : "השמירה נכשלה");
      if (res.ok) router.refresh();
    } catch {
      pushToast("err", "שגיאת רשת - בדוק חיבור ונסה שוב");
    } finally {
      setSavingFd(false);
    }
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
      {/* Free delivery rules */}
      <div className="bg-white rounded-2xl border border-qf-line-dash">
        <header className="px-4 lg:px-5 py-4 border-b border-qf-line-soft">
          <div className="font-semibold">משלוח חינם</div>
          <div className="text-xs text-qf-mute">
            כשהעגלה עומדת באחד התנאים - דמי המשלוח מתאפסים אוטומטית. השאר 0 כדי לבטל תנאי.
          </div>
        </header>
        <div className="px-4 lg:px-5 py-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <Field label="משלוח חינם בקנייה מעל (₪)">
            <div className="flex items-center border border-qf-line-dash rounded-xl focus-within:border-(--qf-primary)">
              <span className="px-3 text-qf-mute">₪</span>
              <input
                type="number"
                min={0}
                value={fd.minOrder}
                onChange={(e) =>
                  setFd((x) => ({ ...x, minOrder: parseInt(e.target.value, 10) || 0 }))
                }
                className="flex-1 py-2.5 outline-none bg-transparent tnum"
              />
            </div>
          </Field>
          <Field label="או בקנייה מעל (מספר פריטים)">
            <div className="flex items-center border border-qf-line-dash rounded-xl focus-within:border-(--qf-primary)">
              <input
                type="number"
                min={0}
                value={fd.minItems}
                onChange={(e) =>
                  setFd((x) => ({ ...x, minItems: parseInt(e.target.value, 10) || 0 }))
                }
                className="flex-1 px-3 py-2.5 outline-none bg-transparent tnum"
              />
              <span className="px-3 text-qf-mute text-sm">פריטים</span>
            </div>
          </Field>
          <button
            type="button"
            onClick={saveFreeDelivery}
            disabled={savingFd}
            className="px-4 py-2.5 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
          >
            {savingFd ? "שומר..." : "שמירה"}
          </button>
        </div>
      </div>

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
            <ZoneFields draft={addForm} onChange={setAddForm} />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={add}
                disabled={!addForm.name || busy}
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
            {zones.map((z) =>
              editingId === z.id ? (
                <div
                  key={z.id}
                  className="px-4 lg:px-5 py-4 space-y-3 bg-qf-line-soft/40"
                >
                  <ZoneFields draft={editForm} onChange={setEditForm} />
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-lg text-sm text-qf-ink2 hover:bg-qf-line-soft"
                    >
                      ביטול
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(z.id)}
                      disabled={!editForm.name || savingEdit}
                      className="px-4 py-1.5 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm disabled:opacity-60"
                    >
                      {savingEdit ? "שומר..." : "שמור שינויים"}
                    </button>
                  </div>
                </div>
              ) : (
                <div key={z.id} className="px-4 lg:px-5 py-3 space-y-2">
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
                        {z.minEta}-{z.maxEta} דק׳
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
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(z)}
                        className="text-xs text-(--qf-deep) hover:underline px-2 py-1"
                      >
                        ערוך
                      </button>
                      <button
                        type="button"
                        onClick={() => startDelete(z)}
                        className="w-8 h-8 rounded-lg hover:bg-qf-tomato-soft text-qf-mute hover:text-qf-tomato grid place-items-center"
                        aria-label="הסר אזור"
                        title="הסר אזור"
                      >
                        <IcoClose s={14} />
                      </button>
                    </div>
                  </div>

                  {z.cities.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => startEdit(z)}
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
                    </div>
                  )}
                </div>
              ),
            )}
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

function ZoneFields({
  draft,
  onChange,
}: {
  draft: ZoneDraft;
  onChange: (d: ZoneDraft) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
        <Field label="שם">
          <input
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="מרכז ת״א"
            className="w-full px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm"
          />
        </Field>
        <Field label="רדיוס (ק״מ)">
          <input
            type="number"
            min={0.1}
            step={0.5}
            value={draft.radiusKm}
            onChange={(e) => onChange({ ...draft, radiusKm: parseFloat(e.target.value) || 0 })}
            className="w-full px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm tnum"
          />
        </Field>
        <Field label="דמי משלוח">
          <input
            type="number"
            min={0}
            value={draft.deliveryFee}
            onChange={(e) => onChange({ ...draft, deliveryFee: parseInt(e.target.value, 10) || 0 })}
            className="w-full px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm tnum"
          />
        </Field>
        <Field label="מינימום הזמנה (₪)">
          <input
            type="number"
            min={0}
            placeholder="0 = ללא מינימום"
            value={draft.minOrder || ""}
            onChange={(e) => onChange({ ...draft, minOrder: parseInt(e.target.value, 10) || 0 })}
            className="w-full px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm tnum"
          />
        </Field>
        <Field label="משלוח חינם בקנייה מעל (₪)">
          <input
            type="number"
            min={0}
            placeholder="0 = ללא"
            value={draft.freeDeliveryAbove || ""}
            onChange={(e) => onChange({ ...draft, freeDeliveryAbove: parseInt(e.target.value, 10) || 0 })}
            className="w-full px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm tnum"
          />
        </Field>
        <Field label="זמן משלוח משוער מינ׳">
          <input
            type="number"
            min={0}
            value={draft.minEta}
            onChange={(e) => onChange({ ...draft, minEta: parseInt(e.target.value, 10) || 0 })}
            className="w-full px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm tnum"
          />
        </Field>
        <Field label="זמן משלוח משוער מקס׳">
          <input
            type="number"
            min={0}
            value={draft.maxEta}
            onChange={(e) => onChange({ ...draft, maxEta: parseInt(e.target.value, 10) || 0 })}
            className="w-full px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm tnum"
          />
        </Field>
      </div>
      <Field label="ערים בכיסוי (מפרידים בפסיק)">
        <textarea
          value={draft.citiesRaw}
          onChange={(e) => onChange({ ...draft, citiesRaw: e.target.value })}
          rows={2}
          placeholder="תל אביב יפו, רמת גן, גבעתיים"
          className="w-full px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm bg-white resize-none"
        />
      </Field>
    </>
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
