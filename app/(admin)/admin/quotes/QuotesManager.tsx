"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Quote {
  id: string;
  token: string;
  clientName: string;
  monthlyPrice: number;
  commissionStruck: string | null;
  commissionActual: string | null;
  notes: string | null;
  status: "sent" | "signed";
  signerName: string | null;
  signedAt: string | null;
  createdAt: string;
}

const EMPTY = {
  clientName: "",
  monthlyPrice: "",
  commissionStruck: "0.5%",
  commissionActual: "0",
  notes: "",
};

function fmt(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function QuotesManager({ initial }: { initial: Quote[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  function reset() {
    setForm({ ...EMPTY });
    setEditingId(null);
    setErr("");
  }

  function startEdit(q: Quote) {
    setEditingId(q.id);
    setForm({
      clientName: q.clientName,
      monthlyPrice: String(q.monthlyPrice),
      commissionStruck: q.commissionStruck ?? "",
      commissionActual: q.commissionActual ?? "",
      notes: q.notes ?? "",
    });
    setErr("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    setErr("");
    const price = parseInt(form.monthlyPrice, 10);
    if (!form.clientName.trim()) return setErr("נא למלא שם לקוח");
    if (!Number.isFinite(price) || price < 0) return setErr("נא למלא מחיר חודשי תקין");
    setBusy(true);
    const payload = {
      clientName: form.clientName.trim(),
      monthlyPrice: price,
      commissionStruck: form.commissionStruck.trim() || null,
      commissionActual: form.commissionActual.trim() || null,
      notes: form.notes.trim() || null,
    };
    const url = editingId ? `/api/v1/admin/quotes/${editingId}` : "/api/v1/admin/quotes";
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      return setErr(d?.error?.message || "שמירה נכשלה");
    }
    reset();
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("למחוק את ההצעה?")) return;
    await fetch(`/api/v1/admin/quotes/${id}`, { method: "DELETE" });
    if (editingId === id) reset();
    router.refresh();
  }

  async function setStatus(id: string, status: "sent" | "signed") {
    await fetch(`/api/v1/admin/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  function linkFor(token: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://quickfood.co.il";
    return `${origin}/qute/${token}`;
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      setCopied(token);
      setTimeout(() => setCopied((c) => (c === token ? null : c)), 1500);
    } catch {
      /* noop */
    }
  }

  const inputCls = "w-full border border-qf-line-dash rounded-lg px-3 py-2 text-sm bg-white";

  return (
    <div className="space-y-5">
      {/* form */}
      <div className="bg-white border border-qf-line-dash rounded-xl p-4 space-y-3">
        <div className="font-bold text-sm text-qf-ink">
          {editingId ? "עריכת הצעה" : "הצעה חדשה"}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-qf-mute mb-1">שם לקוח</label>
            <input className={inputCls} value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              placeholder="אביחי בורגר סלון" />
          </div>
          <div>
            <label className="block text-xs text-qf-mute mb-1">מחיר מערכת חודשי (₪)</label>
            <input className={inputCls} inputMode="numeric" value={form.monthlyPrice}
              onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })}
              placeholder="999" />
          </div>
          <div>
            <label className="block text-xs text-qf-mute mb-1">עמלה - מחיר מקורי (מחוק)</label>
            <input className={inputCls} value={form.commissionStruck}
              onChange={(e) => setForm({ ...form, commissionStruck: e.target.value })}
              placeholder="0.5%" />
          </div>
          <div>
            <label className="block text-xs text-qf-mute mb-1">עמלה - בפועל</label>
            <input className={inputCls} value={form.commissionActual}
              onChange={(e) => setForm({ ...form, commissionActual: e.target.value })}
              placeholder="0" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-qf-mute mb-1">הערות</label>
          <textarea className={`${inputCls} min-h-[72px]`} value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="מחיר עבור מסעדה וסניף אחד. מחיר פיקס פרייס ללא הגבלת הזמנות..." />
        </div>
        {err && <div className="text-xs text-qf-tomato font-bold">{err}</div>}
        <div className="flex gap-2">
          <button onClick={save} disabled={busy}
            className="bg-qf-ink text-white text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-50">
            {busy ? "שומר..." : editingId ? "שמירת שינויים" : "צור הצעה + לינק"}
          </button>
          {editingId && (
            <button onClick={reset} className="text-sm font-bold rounded-lg px-4 py-2 border border-qf-line-dash">
              ביטול
            </button>
          )}
        </div>
      </div>

      {/* list */}
      {initial.length === 0 ? (
        <div className="bg-white border border-qf-line-dash rounded-xl p-10 text-center text-qf-mute text-sm">
          עדיין אין הצעות. צרו את הראשונה למעלה.
        </div>
      ) : (
        <div className="space-y-3">
          {initial.map((q) => (
            <div key={q.id} className="bg-white border border-qf-line-dash rounded-xl p-4">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <div className="font-bold text-qf-ink flex items-center gap-2">
                    {q.clientName}
                    {q.status === "signed" ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">נחתם</span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">נשלח</span>
                    )}
                  </div>
                  <div className="text-xs text-qf-mute mt-1">
                    {q.monthlyPrice.toLocaleString("he-IL")} ₪ לחודש
                    {q.commissionActual ? ` · עמלה ${q.commissionActual}` : ""}
                    {" · "}נוצר {fmt(q.createdAt)}
                    {q.status === "signed" && q.signerName ? ` · נחתם ע"י ${q.signerName} (${fmt(q.signedAt)})` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={linkFor(q.token)} target="_blank" rel="noopener"
                    className="text-xs font-bold text-qf-ink border border-qf-line-dash rounded-lg px-3 py-1.5 hover:bg-qf-line-soft" dir="ltr">
                    /qute/{q.token}
                  </a>
                  <button onClick={() => copy(q.token)}
                    className="text-xs font-bold rounded-lg px-3 py-1.5 bg-qf-line-soft hover:bg-qf-line-dash">
                    {copied === q.token ? "הועתק!" : "העתק לינק"}
                  </button>
                  <button onClick={() => startEdit(q)}
                    className="text-xs font-bold rounded-lg px-3 py-1.5 border border-qf-line-dash hover:bg-qf-line-soft">
                    עריכה
                  </button>
                  {q.status === "signed" && (
                    <button onClick={() => setStatus(q.id, "sent")}
                      className="text-xs font-bold rounded-lg px-3 py-1.5 border border-qf-line-dash hover:bg-qf-line-soft">
                      איפוס לנשלח
                    </button>
                  )}
                  <button onClick={() => remove(q.id)}
                    className="text-xs font-bold rounded-lg px-3 py-1.5 text-qf-tomato hover:bg-red-50">
                    מחיקה
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
