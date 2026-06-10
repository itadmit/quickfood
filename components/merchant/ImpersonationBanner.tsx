"use client";

import { useState } from "react";

export function ImpersonationBanner() {
  const [busy, setBusy] = useState(false);

  async function returnToAdmin() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/admin/impersonate/stop", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      window.location.href = data?.redirect ?? "/admin";
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="bg-black text-white text-sm px-4 py-2 flex items-center justify-center gap-2 flex-wrap text-center">
      <span className="font-medium">הינך מחובר כאדמין לחנות זו.</span>
      <button
        type="button"
        onClick={returnToAdmin}
        disabled={busy}
        className="font-bold text-(--qf-yolk) underline underline-offset-2 hover:opacity-80 disabled:opacity-60"
      >
        {busy ? "חוזר…" : "לחזרה לאדמין לחץ פה"}
      </button>
    </div>
  );
}
