"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IcoStar, IcoClose } from "@/components/shared/Icons";

const SHOWN_KEY = "qf:review-modal-shown";

/**
 * Pops a short rating modal once per session for the customer's most recent
 * delivered + unreviewed order. The server-side check lives in the customer
 * layout; this component just handles presentation + the three terminal
 * actions: send (POST review), skip (POST dismiss), close (defer to next
 * session).
 */
export function ReviewPromptModal({
  tenantSlug,
  orderId,
  orderNumber,
}: {
  tenantSlug: string;
  orderId: string;
  orderNumber: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = sessionStorage.getItem(`${SHOWN_KEY}:${orderId}`);
      if (seen) return;
      sessionStorage.setItem(`${SHOWN_KEY}:${orderId}`, "1");
    } catch {
      /* ignore quota / private-mode errors */
    }
    // Short delay so the modal doesn't intrude during page-transition flicker.
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [orderId]);

  if (!open) return null;

  async function send() {
    if (rating < 1) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/customer/orders/${orderId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating, text: text.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "שגיאה בשליחת הדירוג");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    setBusy(true);
    try {
      await fetch(`/api/v1/customer/orders/${orderId}/review/dismiss`, {
        method: "POST",
      });
    } catch {
      /* ignore */
    }
    setOpen(false);
    router.refresh();
  }

  function close() {
    // Just hide for this session — don't persist dismissal.
    setOpen(false);
  }

  function openFullReview() {
    setOpen(false);
    router.push(`/${tenantSlug}/orders/${orderId}#review`);
  }

  const shown = hover || rating;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-5 relative">
        <button
          type="button"
          onClick={close}
          aria-label="סגירה"
          className="absolute top-3 end-3 w-8 h-8 rounded-full grid place-items-center hover:bg-qf-line-soft"
        >
          <IcoClose c="#11231a" s={16} />
        </button>

        <div className="text-center">
          <div className="text-lg font-bold">איך הייתה ההזמנה?</div>
          <div className="text-xs text-qf-mute mt-0.5">#{orderNumber}</div>
        </div>

        <div
          className="flex items-center justify-center gap-1 mt-4"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} כוכבים`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              className="p-1"
            >
              <IcoStar
                s={36}
                c={n <= shown ? "#f5a524" : "#d4d4d4"}
                fill={n <= shown ? "#f5a524" : "none"}
              />
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ספר/י עוד (לא חובה)"
          rows={2}
          maxLength={500}
          className="mt-3 w-full bg-qf-bg/60 border border-qf-line rounded-xl px-3 py-2 text-sm outline-none focus:border-(--qf-primary) resize-none"
        />

        {error && (
          <div className="mt-2 bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-xs rounded-lg px-3 py-1.5">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={send}
            disabled={rating < 1 || busy}
            className="w-full py-2.5 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white font-medium text-sm disabled:opacity-60"
          >
            {busy ? "שולח..." : "שליחת דירוג"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openFullReview}
              className="flex-1 py-2 rounded-xl border border-qf-line text-xs text-qf-ink2"
            >
              דירוג מפורט
            </button>
            <button
              type="button"
              onClick={skip}
              disabled={busy}
              className="flex-1 py-2 rounded-xl text-xs text-qf-mute disabled:opacity-60"
            >
              דלג
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
