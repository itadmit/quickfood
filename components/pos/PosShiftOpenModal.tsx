"use client";

import { useState } from "react";
import type { PosShiftState } from "@/components/pos/PosContext";
import { PosNumericKeypadModal } from "@/components/pos/PosNumericKeypad";

export function PosShiftOpenModal({ onOpened }: { onOpened: (shift: PosShiftState) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open(openingFloat: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/pos/shift/open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ opening_float: openingFloat }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "פתיחת המשמרת נכשלה");
        return;
      }
      onOpened({
        id: data.shift.id,
        openedAt: data.shift.opened_at,
        openingFloat: data.shift.opening_float,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && (
        <div className="fixed top-4 inset-x-0 z-[60] flex justify-center pointer-events-none">
          <div className="pointer-events-auto bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-4 py-2">
            {error}
          </div>
        </div>
      )}
      <PosNumericKeypadModal
        title="פתיחת משמרת"
        confirmLabel={busy ? "פותח..." : "פתח משמרת"}
        cancelLabel="הוסף 0"
        quickAmounts={[200, 500, 1000]}
        confirmDisabled={() => busy}
        liveCaption={(typed) => ({
          text: typed === 0 ? "ללא כסף במגירה" : `מגירת פתיחה: ₪${typed.toLocaleString("he-IL")}`,
          tone: "muted",
        })}
        onCancel={() => open(0)}
        onConfirm={(typed) => open(typed)}
      />
    </>
  );
}
