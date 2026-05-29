"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

type Status = "available" | "on_delivery" | "break_time" | "offline";

const OPTIONS: Array<{ id: "available" | "break_time" | "offline"; label: string }> = [
  { id: "available", label: "פנוי" },
  { id: "break_time", label: "הפסקה" },
  { id: "offline", label: "סיום משמרת" },
];

export function CourierStatusToggle({
  status,
  onChange,
}: {
  status: Status;
  onChange: (s: Status) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function set(next: "available" | "break_time" | "offline") {
    if (status === "on_delivery") return;
    setBusy(next);
    const res = await fetch("/api/v1/courier/status", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(null);
    if (res.ok) onChange(next);
  }

  if (status === "on_delivery") {
    return (
      <div className="rounded-2xl bg-emerald-500/15 border border-emerald-500/30 p-4 text-center">
        <p className="text-emerald-300 font-medium">במשלוח עכשיו</p>
        <p className="text-xs text-emerald-200/70 mt-0.5">
          הסטטוס יחזור אוטומטית לפנוי אחרי מסירה
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-white/5 border border-white/10">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => set(o.id)}
          disabled={!!busy}
          className={cn(
            "py-2.5 rounded-xl text-sm font-medium transition",
            status === o.id
              ? "bg-white text-[#0b1a14]"
              : "text-white/70 hover:bg-white/5",
            busy === o.id && "opacity-60",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
