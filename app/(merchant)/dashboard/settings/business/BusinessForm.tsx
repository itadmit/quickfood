"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IcoCheck } from "@/components/shared/Icons";

interface Initial {
  name: string;
  address: string;
  phone: string;
  email: string;
  minOrder: number;
  deliveryFee: number;
  serviceFee: number;
  vatNumber: string;
}

export function BusinessForm({ branchId, initial }: { branchId: string; initial: Initial }) {
  const router = useRouter();
  const [v, setV] = useState<Initial>(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function set<K extends keyof Initial>(k: K, val: Initial[K]) {
    setV((x) => ({ ...x, [k]: val }));
  }

  async function save() {
    setSaving(true);
    setToast(null);
    try {
      const [branchRes, tenantRes] = await Promise.all([
        fetch(`/api/v1/merchant/branches/${branchId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: v.name,
            address: v.address,
            phone: v.phone,
            email: v.email || undefined,
            min_order: v.minOrder,
            delivery_fee: v.deliveryFee,
            service_fee: v.serviceFee,
          }),
        }),
        fetch(`/api/v1/merchant/tenant`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ vat_number: v.vatNumber || undefined }),
        }),
      ]);
      setToast(branchRes.ok && tenantRes.ok ? "נשמר" : "שמירה נכשלה");
      if (branchRes.ok) router.refresh();
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2000);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="שם הסניף">
          <input
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
          />
        </Field>
        <Field label="טלפון">
          <input
            value={v.phone}
            onChange={(e) => set("phone", e.target.value)}
            dir="ltr"
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
          />
        </Field>
      </div>
      <Field label="כתובת מלאה">
        <input
          value={v.address}
          onChange={(e) => set("address", e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="דוא״ל">
          <input
            value={v.email}
            onChange={(e) => set("email", e.target.value)}
            type="email"
            dir="ltr"
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
          />
        </Field>
        <Field label="ח״פ / עוסק">
          <input
            value={v.vatNumber}
            onChange={(e) => set("vatNumber", e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none tnum"
          />
        </Field>
      </div>

      <hr className="border-qf-line-soft" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="סכום מינימום">
          <NumberField value={v.minOrder} onChange={(n) => set("minOrder", n)} />
        </Field>
        <Field label="דמי משלוח (ברירת מחדל)">
          <NumberField value={v.deliveryFee} onChange={(n) => set("deliveryFee", n)} />
        </Field>
        <Field label="דמי שירות">
          <NumberField value={v.serviceFee} onChange={(n) => set("serviceFee", n)} />
        </Field>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-qf-line-soft">
        <div className="text-sm">
          {toast && (
            <span className="inline-flex items-center gap-1.5 text-qf-green-deep">
              <IcoCheck c="currentColor" s={14} />
              {toast}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
        >
          {saving ? "שומר..." : "שמירת שינויים"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium block">{label}</label>
      {children}
    </div>
  );
}

function NumberField({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center border border-qf-line-dash rounded-xl focus-within:border-(--qf-primary)">
      <span className="px-3 text-qf-mute">₪</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="flex-1 py-2.5 outline-none bg-transparent tnum"
      />
    </div>
  );
}
