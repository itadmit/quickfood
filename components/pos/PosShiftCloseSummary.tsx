"use client";

import { useEffect, useState } from "react";
import type { PosShiftState } from "@/components/pos/PosContext";
import { PosNumericKeypadModal } from "@/components/pos/PosNumericKeypad";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Summary {
  expected_cash: number;
  cash_orders_total: number;
  card_orders_total: number;
  cash_orders_count: number;
  card_orders_count: number;
  cash_out_total: number;
}

export function PosShiftCloseSummary({
  shift,
  onClose,
  onClosed,
}: {
  shift: PosShiftState;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [stage, setStage] = useState<"enter" | "summary">("enter");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [closingFloat, setClosingFloat] = useState(0);

  // Pre-fetch the expected cash + counts so the cashier sees variance
  // immediately after they type the actual count.
  useEffect(() => {
    fetch("/api/v1/merchant/pos/shift/current?include_summary=1", {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.summary) setSummary(d.summary);
      })
      .catch(() => {});
  }, []);

  async function close(closing: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/pos/shift/close", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ closing_float: closing }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "סגירת המשמרת נכשלה");
        return;
      }
      setSummary(data.summary as Summary);
      setClosingFloat(closing);
      setStage("summary");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "enter") {
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
          title="ספירת מגירה לסיום משמרת"
          confirmLabel={busy ? "סוגר..." : "סגור משמרת"}
          cancelLabel="חזור"
          quickAmounts={
            summary
              ? [summary.expected_cash, summary.expected_cash + 100]
                  .filter((n) => n > 0)
              : []
          }
          confirmDisabled={() => busy}
          liveCaption={(typed) =>
            summary
              ? typed === summary.expected_cash
                ? { text: "תואם לציפי", tone: "green" }
                : typed > summary.expected_cash
                  ? {
                      text: `עודף ₪${(typed - summary.expected_cash).toLocaleString("he-IL")}`,
                      tone: "green",
                    }
                  : {
                      text: `חוסר ₪${(summary.expected_cash - typed).toLocaleString("he-IL")}`,
                      tone: "red",
                    }
              : { text: " ", tone: "muted" }
          }
          onCancel={onClose}
          onConfirm={(typed) => close(typed)}
        />
      </>
    );
  }

  // Stage = "summary"
  if (!summary) {
    return null;
  }
  const variance = closingFloat - summary.expected_cash;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border-2 border-black shadow-[0_6px_0_#000] p-6 animate-qf-check-in space-y-4">
        <h2 className="text-xl font-black text-center">סיכום המשמרת</h2>

        <dl className="space-y-2 text-sm">
          <Row label="פתיחה" value={shift.openingFloat} />
          <Row label={`מזומן (${summary.cash_orders_count})`} value={summary.cash_orders_total} />
          <Row label={`אשראי (${summary.card_orders_count})`} value={summary.card_orders_total} />
          <Row label="הוצאות מגירה" value={-summary.cash_out_total} />
          <Row label="ציפי" value={summary.expected_cash} bold />
          <Row label="ספירה בפועל" value={closingFloat} />
          <Row label="פער" value={variance} tone={variance === 0 ? "muted" : variance > 0 ? "green" : "red"} bold />
        </dl>

        <button
          type="button"
          onClick={onClosed}
          className="w-full px-5 py-3 rounded-2xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-base shadow-[0_3px_0_#000]"
        >
          סיים והתחל משמרת חדשה
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone = "muted",
  bold,
}: {
  label: string;
  value: number;
  tone?: "muted" | "green" | "red";
  bold?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between", bold && "font-bold")}>
      <dt className="text-qf-ink2">{label}</dt>
      <dd
        className={cn(
          "tnum",
          tone === "green" && "text-qf-green-deep",
          tone === "red" && "text-qf-tomato",
        )}
      >
        {value < 0 ? `-${formatPrice(Math.abs(value))}` : formatPrice(value)}
      </dd>
    </div>
  );
}
